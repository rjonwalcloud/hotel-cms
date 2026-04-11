const rateService = require('./rate.service');
const db = require('../../../config/database');
const { formatDate } = require('../../../utils/dateUtils');

class QuoteService {
    /**
     * Generate a price quote for a room booking.
     * This is the centralized pricing engine used by ALL UI surfaces.
     * 
     * @param {Object} params
     * @param {string} params.hotel_id
     * @param {string} params.room_type_id
     * @param {string} params.check_in - date string
     * @param {string} params.check_out - date string
     * @param {number} params.quantity - number of rooms
     * @param {number} [params.adults] - number of adults
     * @param {number} [params.children] - number of children
     * @param {string} [params.coupon_code] - optional coupon code
     * @returns {Object} Price breakdown
     */
    async getQuote(params) {
        let { hotel_id, room_type_id, check_in, check_out, quantity = 1, adults = 1, children = 0, coupon_code } = params;
        adults = parseInt(adults) || 1;
        children = parseInt(children) || 0;

        if (!hotel_id || !room_type_id || !check_in || !check_out) {
            throw new Error('hotel_id, room_type_id, check_in, and check_out are required');
        }

        const checkInDate = new Date(check_in);
        const checkOutDate = new Date(check_out);

        // Use local-safe formatting for queries
        const formattedCheckIn = formatDate(checkInDate);
        const formattedCheckOut = formatDate(checkOutDate);

        const nights = Math.max(1, Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));

        // 1. Get the effective rate (rate rule override or base_price fallback)
        const rateInfo = await rateService.getEffectiveRate(room_type_id, hotel_id, formattedCheckIn, formattedCheckOut);
        const ratePerNight = rateInfo.price;

        // 2. Calculate room subtotal
        const roomSubtotal = ratePerNight * quantity * nights;

        // 3. Calculate occupancy surcharge
        let occupancySurcharge = 0;
        let occupancyDetails = null;

        if (adults > 0 || children > 0) {
            const rtResult = await db.query(
                'SELECT max_occupancy, max_adults, max_children, extra_adult_charge, extra_child_charge FROM room_types WHERE id = $1 AND hotel_id = $2',
                [room_type_id, hotel_id]
            );
            if (rtResult.rows.length > 0) {
                const rt = rtResult.rows[0];
                const maxAdults = parseInt(rt.max_adults) || 2;
                const maxChildren = parseInt(rt.max_children) || 0;
                const extraAdultCharge = parseFloat(rt.extra_adult_charge) || 0;
                const extraChildCharge = parseFloat(rt.extra_child_charge) || 0;
                const maxOccupancy = parseInt(rt.max_occupancy) || (maxAdults + maxChildren);

                // Per-room calculation: extra guests beyond base included
                const extraAdults = Math.max(0, adults - (maxAdults * quantity));
                const extraChildren = Math.max(0, children - (maxChildren * quantity));

                // Enforce max occupancy
                const totalGuests = adults + children;
                const totalCapacity = maxOccupancy * quantity;
                if (totalGuests > totalCapacity) {
                    throw new Error(`Total guests (${totalGuests}) exceeds maximum occupancy (${totalCapacity}) for ${quantity} room(s)`);
                }

                occupancySurcharge = (extraAdults * extraAdultCharge + extraChildren * extraChildCharge) * nights;
                occupancyDetails = {
                    max_adults: maxAdults,
                    max_children: maxChildren,
                    max_occupancy: maxOccupancy,
                    extra_adults: extraAdults,
                    extra_children: extraChildren,
                    extra_adult_charge: extraAdultCharge,
                    extra_child_charge: extraChildCharge,
                    surcharge_per_night: extraAdults * extraAdultCharge + extraChildren * extraChildCharge,
                    total_surcharge: Number(occupancySurcharge.toFixed(2))
                };
            }
        }

        // 4. Check for auto-apply promotions
        let promoDiscount = 0;
        let appliedPromo = null;

        const promoResult = await db.query(
            `SELECT * FROM promotions
             WHERE hotel_id = $1
               AND is_active = true
               AND auto_apply = true
               AND (start_date IS NULL OR start_date <= $5::DATE)
               AND (end_date IS NULL OR end_date >= $5::DATE)
               AND (min_nights IS NULL OR min_nights <= $2)
               AND (min_amount IS NULL OR min_amount <= $3)
               AND (applicable_room_types IS NULL OR array_length(applicable_room_types, 1) IS NULL OR $4 = ANY(applicable_room_types))
             ORDER BY discount_value DESC
             LIMIT 1`,
            [hotel_id, nights, roomSubtotal, room_type_id, formattedCheckIn]
        );

        if (promoResult.rows.length > 0) {
            const promo = promoResult.rows[0];
            if (promo.discount_type === 'PERCENTAGE') {
                promoDiscount = roomSubtotal * (parseFloat(promo.discount_value) / 100);
            } else {
                promoDiscount = parseFloat(promo.discount_value);
            }
            if (promo.max_discount) {
                promoDiscount = Math.min(promoDiscount, parseFloat(promo.max_discount));
            }
            appliedPromo = {
                id: promo.id,
                name: promo.name,
                discount_type: promo.discount_type,
                discount_value: parseFloat(promo.discount_value),
                discount_amount: Number(promoDiscount.toFixed(2))
            };
        }

        // 5. Apply coupon code if provided
        let couponDiscount = 0;
        let appliedCoupon = null;

        if (coupon_code) {
            try {
                const promotionService = require('../../promotion/services/promotion.service');
                const couponResult = await promotionService.validateCoupon(
                    coupon_code, hotel_id, roomSubtotal - promoDiscount, nights, room_type_id
                );
                couponDiscount = couponResult.discount_amount;
                appliedCoupon = {
                    coupon_id: couponResult.coupon_id,
                    code: coupon_code.toUpperCase(),
                    discount_type: couponResult.discount_type,
                    discount_value: couponResult.discount_value,
                    discount_amount: couponResult.discount_amount
                };
            } catch (err) {
                // Coupon validation failed — include the error but don't block the quote
                appliedCoupon = { valid: false, error: err.message };
            }
        }

        // 6. Calculate taxes (on room charges + occupancy surcharge)
        const settingsService = require('../../settings/services/settings.service');
        const taxes = await settingsService.getTaxes(hotel_id);
        const activeTaxes = taxes.filter(t => t.is_active);

        const afterDiscounts = roomSubtotal + occupancySurcharge - promoDiscount - couponDiscount;
        const taxBreakdown = [];
        let taxTotal = 0;

        activeTaxes.filter(t => t.is_inclusive).forEach(tax => {
            const rate = parseFloat(tax.rate);
            if (tax.category === 'ROOM' || tax.category === 'ALL') {
                const base = afterDiscounts / (1 + rate / 100);
                const taxAmount = afterDiscounts - base;
                taxBreakdown.push({ name: tax.name, rate, is_inclusive: true, amount: Number(taxAmount.toFixed(2)) });
            }
        });

        activeTaxes.filter(t => !t.is_inclusive).forEach(tax => {
            const rate = parseFloat(tax.rate);
            if (tax.category === 'ROOM' || tax.category === 'ALL') {
                const taxAmount = afterDiscounts * (rate / 100);
                taxBreakdown.push({ name: tax.name, rate, is_inclusive: false, amount: Number(taxAmount.toFixed(2)) });
                taxTotal += taxAmount;
            }
        });

        const finalTotal = afterDiscounts + taxTotal;

        return {
            room_type_id,
            quantity,
            nights,
            adults,
            children,
            rate_per_night: ratePerNight,
            rate_source: rateInfo.source,
            rate_plan: rateInfo.plan_name,
            rate_rule: rateInfo.rule_name,
            room_subtotal: Number(roomSubtotal.toFixed(2)),
            occupancy_surcharge: Number(occupancySurcharge.toFixed(2)),
            occupancy_details: occupancyDetails,
            promo_discount: Number(promoDiscount.toFixed(2)),
            coupon_discount: Number(couponDiscount.toFixed(2)),
            applied_promotion: appliedPromo,
            applied_coupon: appliedCoupon,
            tax_breakdown: taxBreakdown,
            tax_total: Number(taxTotal.toFixed(2)),
            final_total: Number(finalTotal.toFixed(2))
        };
    }
}

module.exports = new QuoteService();
