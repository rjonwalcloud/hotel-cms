const db = require('../../../config/database');

class PromotionService {
    // =================== PROMOTIONS ===================

    async getPromotions(hotelId) {
        const result = await db.query(
            `SELECT p.*,
              CASE WHEN p.applicable_room_types IS NOT NULL THEN
                (SELECT json_agg(json_build_object('id', rt.id, 'name', rt.name))
                 FROM room_types rt WHERE rt.id = ANY(p.applicable_room_types))
              ELSE NULL END as room_types_info
             FROM promotions p
             WHERE p.hotel_id = $1
             ORDER BY p.created_at DESC`,
            [hotelId]
        );
        return result.rows;
    }

    async createPromotion(data, hotelId) {
        const {
            name, description, discount_type, discount_value, auto_apply,
            start_date, end_date, min_nights, min_amount, max_discount,
            applicable_room_types, is_active
        } = data;

        const result = await db.query(
            `INSERT INTO promotions (hotel_id, name, description, discount_type, discount_value,
             auto_apply, start_date, end_date, min_nights, min_amount, max_discount,
             applicable_room_types, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [hotelId, name, description, discount_type, discount_value,
                auto_apply || false, start_date || null, end_date || null,
                min_nights || 1, min_amount || 0, max_discount || null,
                applicable_room_types || null, is_active !== false]
        );
        return result.rows[0];
    }

    async updatePromotion(id, data, hotelId) {
        const {
            name, description, discount_type, discount_value, auto_apply,
            start_date, end_date, min_nights, min_amount, max_discount,
            applicable_room_types, is_active
        } = data;

        const result = await db.query(
            `UPDATE promotions SET name = $1, description = $2, discount_type = $3, discount_value = $4,
             auto_apply = $5, start_date = $6, end_date = $7, min_nights = $8, min_amount = $9,
             max_discount = $10, applicable_room_types = $11, is_active = $12, updated_at = CURRENT_TIMESTAMP
             WHERE id = $13 AND hotel_id = $14 RETURNING *`,
            [name, description, discount_type, discount_value,
                auto_apply || false, start_date || null, end_date || null,
                min_nights || 1, min_amount || 0, max_discount || null,
                applicable_room_types || null, is_active !== false, id, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Promotion not found');
        return result.rows[0];
    }

    async deletePromotion(id, hotelId) {
        const result = await db.query(
            'DELETE FROM promotions WHERE id = $1 AND hotel_id = $2 RETURNING id',
            [id, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Promotion not found');
        return { deleted: true };
    }

    // =================== COUPON CODES ===================

    async getCouponCodes(hotelId) {
        const result = await db.query(
            `SELECT c.*,
              CASE WHEN c.applicable_room_types IS NOT NULL THEN
                (SELECT json_agg(json_build_object('id', rt.id, 'name', rt.name))
                 FROM room_types rt WHERE rt.id = ANY(c.applicable_room_types))
              ELSE NULL END as room_types_info
             FROM coupon_codes c
             WHERE c.hotel_id = $1
             ORDER BY c.created_at DESC`,
            [hotelId]
        );
        return result.rows;
    }

    async createCouponCode(data, hotelId) {
        const {
            code, description, discount_type, discount_value, max_uses,
            per_booking_limit, start_date, end_date, min_nights, min_amount,
            max_discount, applicable_room_types, is_active
        } = data;

        const result = await db.query(
            `INSERT INTO coupon_codes (hotel_id, code, description, discount_type, discount_value,
             max_uses, per_booking_limit, start_date, end_date, min_nights, min_amount,
             max_discount, applicable_room_types, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [hotelId, code.toUpperCase(), description, discount_type, discount_value,
                max_uses || null, per_booking_limit || 1,
                start_date || null, end_date || null,
                min_nights || 1, min_amount || 0, max_discount || null,
                applicable_room_types || null, is_active !== false]
        );
        return result.rows[0];
    }

    async updateCouponCode(id, data, hotelId) {
        const {
            code, description, discount_type, discount_value, max_uses,
            per_booking_limit, start_date, end_date, min_nights, min_amount,
            max_discount, applicable_room_types, is_active
        } = data;

        const result = await db.query(
            `UPDATE coupon_codes SET code = $1, description = $2, discount_type = $3, discount_value = $4,
             max_uses = $5, per_booking_limit = $6, start_date = $7, end_date = $8,
             min_nights = $9, min_amount = $10, max_discount = $11, applicable_room_types = $12,
             is_active = $13, updated_at = CURRENT_TIMESTAMP
             WHERE id = $14 AND hotel_id = $15 RETURNING *`,
            [code.toUpperCase(), description, discount_type, discount_value,
            max_uses || null, per_booking_limit || 1,
            start_date || null, end_date || null,
            min_nights || 1, min_amount || 0, max_discount || null,
            applicable_room_types || null, is_active !== false, id, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Coupon code not found');
        return result.rows[0];
    }

    async deleteCouponCode(id, hotelId) {
        const result = await db.query(
            'DELETE FROM coupon_codes WHERE id = $1 AND hotel_id = $2 RETURNING id',
            [id, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Coupon code not found');
        return { deleted: true };
    }

    /**
     * Validate and apply a coupon code
     */
    async validateCoupon(code, hotelId, bookingAmount, nights, roomTypeId) {
        const result = await db.query(
            `SELECT * FROM coupon_codes
             WHERE hotel_id = $1 AND code = $2 AND is_active = true`,
            [hotelId, code.toUpperCase()]
        );

        if (result.rows.length === 0) {
            throw new Error('Invalid or expired coupon code');
        }

        const coupon = result.rows[0];
        const now = new Date();

        if (coupon.start_date && new Date(coupon.start_date) > now) {
            throw new Error('Coupon is not yet active');
        }
        if (coupon.end_date && new Date(coupon.end_date) < now) {
            throw new Error('Coupon has expired');
        }
        if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
            throw new Error('Coupon usage limit reached');
        }
        if (nights < (coupon.min_nights || 1)) {
            throw new Error(`Minimum ${coupon.min_nights} night(s) required for this coupon`);
        }
        if (bookingAmount < parseFloat(coupon.min_amount || 0)) {
            throw new Error(`Minimum booking amount of ${coupon.min_amount} required`);
        }
        if (coupon.applicable_room_types && roomTypeId &&
            !coupon.applicable_room_types.includes(roomTypeId)) {
            throw new Error('Coupon is not applicable for this room type');
        }

        let discount = 0;
        if (coupon.discount_type === 'PERCENTAGE') {
            discount = bookingAmount * (parseFloat(coupon.discount_value) / 100);
        } else {
            discount = parseFloat(coupon.discount_value);
        }

        if (coupon.max_discount) {
            discount = Math.min(discount, parseFloat(coupon.max_discount));
        }

        return {
            valid: true,
            coupon_id: coupon.id,
            discount_amount: Number(discount.toFixed(2)),
            discount_type: coupon.discount_type,
            discount_value: parseFloat(coupon.discount_value)
        };
    }
}

module.exports = new PromotionService();
