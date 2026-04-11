const db = require('../../../config/database');
const bookingService = require('./booking.service');
const promotionService = require('../../promotion/services/promotion.service');

class BulkBookingService {
    /**
     * Create a new Bulk Booking and its child bookings
     */
    async createBulkBooking(bulkData, userId, hotelId) {
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            const {
                company_name,
                guest_name,
                guest_email,
                guest_phone,
                event_details,
                additional_requirements,
                check_in_date,
                check_out_date,
                adults,
                children,
                rooms // Array of { room_type_id, quantity, base_price }
            } = bulkData;

            if (!rooms || rooms.length === 0) {
                throw new Error('At least one room requirement must be provided for a bulk booking.');
            }

            // 1. Calculate the total combined amount for the bulk booking directly via SQL or provided data
            let calculatedTotal = 0;
            const checkInDate = new Date(check_in_date);
            const checkOutDate = new Date(check_out_date);
            const nights = Math.max(1, Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));

            // 2. Validate availability for each requested room type first before locking anything
            for (const roomReq of rooms) {
                const availability = await bookingService.checkRoomTypeAvailability(
                    roomReq.room_type_id,
                    hotelId,
                    check_in_date,
                    check_out_date,
                    client
                );

                if (availability.remaining < roomReq.quantity) {
                    const typeNameRes = await client.query('SELECT name FROM room_types WHERE id = $1', [roomReq.room_type_id]);
                    const typeName = typeNameRes.rows.length > 0 ? typeNameRes.rows[0].name : roomReq.room_type_id;
                    throw new Error(`Insufficient availability for room type: ${typeName}. Required: ${roomReq.quantity}, Remaining: ${availability.remaining}`);
                }

                const typeResult = await client.query('SELECT base_price, max_occupancy FROM room_types WHERE id = $1', [roomReq.room_type_id]);
                const basePrice = typeResult.rows.length > 0 ? parseFloat(typeResult.rows[0].base_price) : 0;
                const maxOccupancy = typeResult.rows.length > 0 ? parseInt(typeResult.rows[0].max_occupancy) || 2 : 2;
                roomReq._maxOccupancy = maxOccupancy; // store for child booking creation
                calculatedTotal += basePrice * roomReq.quantity * nights;
            }

            // 3. Create the Parent Bulk Booking record
            const insertBulkQuery = `
        INSERT INTO bulk_bookings (
          hotel_id, company_name, guest_name, guest_email, guest_phone,
          event_details, additional_requirements, check_in_date, check_out_date,
          adults, children, total_amount, status, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'CREATED', $13)
        RETURNING *
      `;

            const bulkResult = await client.query(insertBulkQuery, [
                hotelId, company_name, guest_name, guest_email, guest_phone,
                event_details, additional_requirements, check_in_date, check_out_date,
                adults || 1, children || 0, bulkData.total_amount || calculatedTotal, userId
            ]);

            const bulkBooking = bulkResult.rows[0];
            const childBookings = [];

            // 4. Create the Child Bookings
            // We loop over the requested room types and call the existing createBooking loop, but override billing
            for (const roomReq of rooms) {
                // Because the child booking will increment inventory via its own service logic,
                // we just invoke it directly using `bookingService.createBooking`
                // but we manually append `bulk_booking_id` afterwards.

                let prefix = 'BB-';
                const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
                const bookingRef = `${prefix}${randomStr}`;

                const insertChildQuery = `
            INSERT INTO bookings (
              booking_ref, hotel_id, bulk_booking_id, guest_name, guest_email, guest_phone,
              check_in_date, check_out_date, adults, children, total_amount,
              status, created_by, room_type_id, quantity
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 'CREATED', $11, $12, $13)
            RETURNING *
          `;

                const childAdults = (roomReq._maxOccupancy || 2) * parseInt(roomReq.quantity);

                const childResult = await client.query(insertChildQuery, [
                    bookingRef, hotelId, bulkBooking.id, guest_name, guest_email, guest_phone,
                    check_in_date, check_out_date, childAdults, 0, userId, roomReq.room_type_id, roomReq.quantity
                ]);

                const childBooking = childResult.rows[0];
                childBookings.push(childBooking);

                // Increment Inventory manually within this transaction
                await client.query(`
            UPDATE room_inventory
            SET booked_count = booked_count + $1
            WHERE hotel_id = $2
            AND room_type_id = $3
            AND inventory_date >= $4::date
            AND inventory_date < $5::date
          `, [roomReq.quantity, hotelId, roomReq.room_type_id, check_in_date, check_out_date]);

            }

            await client.query('COMMIT');
            return { bulkBooking, childBookings };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Fetch a single Bulk Booking by ID
     */
    async getBulkBookingById(id, hotelId) {
        const query = `
      SELECT 
        bb.*,
        u.full_name as created_by_name,
        (
            SELECT json_agg(json_build_object(
                'id', b.id,
                'booking_ref', b.booking_ref,
                'room_type_id', b.room_type_id,
                'room_type_name', rt.name,
                'quantity', b.quantity,
                'adults', b.adults,
                'status', b.status,
                'rooms', COALESCE((
                    SELECT json_agg(json_build_object('id', r.id, 'room_number', r.room_number))
                    FROM booking_rooms br
                    JOIN rooms r ON br.room_id = r.id
                    WHERE br.booking_id = b.id
                ), '[]'::json),
                'guests', COALESCE((
                    SELECT json_agg(json_build_object('full_name', bg.full_name, 'age', bg.age, 'id_proof_type', bg.id_proof_type, 'id_proof_number', bg.id_proof_number, 'is_child', bg.is_child, 'room_idx', bg.room_idx))
                    FROM booking_guests bg
                    WHERE bg.booking_id = b.id
                ), '[]'::json)
            ))
            FROM bookings b
            LEFT JOIN room_types rt ON b.room_type_id = rt.id
            WHERE b.bulk_booking_id = bb.id
        ) as child_bookings
      FROM bulk_bookings bb
      LEFT JOIN users u ON bb.created_by = u.id
      WHERE bb.id = $1 AND bb.hotel_id = $2
    `;
        const result = await db.query(query, [id, hotelId]);
        return result.rows[0];
    }

    /**
     * Fetch Bulk Bookings with nested child summary
     */
    async getBulkBookingsByHotel(hotelId, filters = {}) {
        let query = `
      SELECT 
        bb.*,
        u.full_name as created_by_name,
        (
            SELECT json_agg(json_build_object(
                'id', b.id,
                'booking_ref', b.booking_ref,
                'room_type_id', b.room_type_id,
                'room_type_name', rt.name,
                'quantity', b.quantity,
                'adults', b.adults,
                'status', b.status,
                'rooms', COALESCE((
                    SELECT json_agg(json_build_object('id', r.id, 'room_number', r.room_number))
                    FROM booking_rooms br
                    JOIN rooms r ON br.room_id = r.id
                    WHERE br.booking_id = b.id
                ), '[]'::json),
                'guests', COALESCE((
                    SELECT json_agg(json_build_object('full_name', bg.full_name, 'age', bg.age, 'id_proof_type', bg.id_proof_type, 'id_proof_number', bg.id_proof_number, 'is_child', bg.is_child, 'room_idx', bg.room_idx))
                    FROM booking_guests bg
                    WHERE bg.booking_id = b.id
                ), '[]'::json)
            ))
            FROM bookings b
            LEFT JOIN room_types rt ON b.room_type_id = rt.id
            WHERE b.bulk_booking_id = bb.id
        ) as child_bookings
      FROM bulk_bookings bb
      LEFT JOIN users u ON bb.created_by = u.id
      WHERE bb.hotel_id = $1
    `;

        const params = [hotelId];
        let paramCount = 2;

        if (filters.status) {
            query += ` AND bb.status = $${paramCount}`;
            params.push(filters.status);
            paramCount++;
        }

        if (filters.search) {
            query += ` AND (bb.guest_name ILIKE $${paramCount} OR bb.company_name ILIKE $${paramCount})`;
            params.push(`%${filters.search}%`);
            paramCount++;
        }

        query += ` ORDER BY bb.created_at DESC`;

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Update Bulk Booking Status & Assign Rooms if Checking In
     */
    async updateBulkBookingStatus(bulkBookingId, newStatus, userId, hotelId, roomAssignments = [], guestDetails = []) {
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            if (newStatus === 'CANCELLED') {
                const current = await client.query('SELECT status FROM bulk_bookings WHERE id = $1', [bulkBookingId]);
                if (current.rows.length > 0 && (current.rows[0].status === 'CHECKED_IN' || current.rows[0].status === 'CHECKED_OUT')) {
                    throw new Error('Cannot cancel a bulk booking after it has been checked in');
                }
            }

            // Update Parent
            let invoiceNumberQuery = '';
            let invoiceParams = [newStatus, bulkBookingId, hotelId];

            if (newStatus === 'CHECKED_OUT') {
                const currentRes = await client.query('SELECT invoice_number FROM bulk_bookings WHERE id = $1', [bulkBookingId]);
                if (currentRes.rows.length > 0 && !currentRes.rows[0].invoice_number) {
                    const invoiceNumber = await bookingService.generateInvoiceNumber(hotelId, client);
                    invoiceNumberQuery = ', invoice_number = $4';
                    invoiceParams.push(invoiceNumber);
                }
            }

            const updateResult = await client.query(
                `UPDATE bulk_bookings 
                 SET status = $1, updated_at = CURRENT_TIMESTAMP ${invoiceNumberQuery}
                 WHERE id = $2 AND hotel_id = $3
                 RETURNING *`,
                invoiceParams
            );

            if (updateResult.rows.length === 0) throw new Error('Bulk booking not found');

            // Update Children
            await client.query(
                `UPDATE bookings 
             SET status = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE bulk_booking_id = $2 AND hotel_id = $3`,
                [newStatus, bulkBookingId, hotelId]
            );

            // Handle room assignments and guest details during CHECK In
            if (newStatus === 'CHECKED_IN') {
                const childBookings = await client.query(
                    'SELECT id, quantity FROM bookings WHERE bulk_booking_id = $1 AND hotel_id = $2 ORDER BY created_at',
                    [bulkBookingId, hotelId]
                );

                // Flatten booking IDs based on quantity to easily map the linear arrays
                const flatBookingIds = [];
                childBookings.rows.forEach(b => {
                    for (let j = 0; j < b.quantity; j++) {
                        flatBookingIds.push(b.id);
                    }
                });

                // Assign Rooms
                if (roomAssignments.length > 0) {
                    for (let i = 0; i < flatBookingIds.length && i < roomAssignments.length; i++) {
                        const bookingId = flatBookingIds[i];
                        const roomId = roomAssignments[i];
                        if (!roomId) continue;

                        // Link booking_rooms
                        await client.query(
                            `INSERT INTO booking_rooms (booking_id, room_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                            [bookingId, roomId]
                        );
                        // Update main room reference if not already set
                        await client.query(
                            `UPDATE bookings SET room_id = $1 WHERE id = $2 AND room_id IS NULL`,
                            [roomId, bookingId]
                        );
                        // Mark room OCCUPIED
                        await client.query(
                            `UPDATE rooms SET status = 'OCCUPIED' WHERE id = $1`,
                            [roomId]
                        );
                    }
                }

                // Handle Guest Details
                if (guestDetails && guestDetails.length > 0) {
                    const childIds = childBookings.rows.map(r => r.id);
                    await client.query('DELETE FROM booking_guests WHERE booking_id = ANY($1)', [childIds]);

                    for (const guest of guestDetails) {
                        const bookingId = flatBookingIds[guest.room_idx];
                        if (bookingId) {
                            await client.query(
                                `INSERT INTO booking_guests (booking_id, full_name, age, id_proof_type, id_proof_number, is_child, room_idx)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                [bookingId, guest.full_name, guest.age ? parseInt(guest.age) : null, guest.id_proof_type || 'Aadhar', guest.id_proof_number, guest.is_child || false, guest.room_idx || 0]
                            );
                        }
                    }
                }
            }
            // If checked out or cancelled, free rooms
            if (newStatus === 'CHECKED_OUT' || newStatus === 'CANCELLED') {
                const roomsToFree = await client.query(
                    `SELECT room_id FROM booking_rooms WHERE booking_id IN (SELECT id FROM bookings WHERE bulk_booking_id = $1)
                     UNION
                     SELECT room_id FROM bookings WHERE bulk_booking_id = $1 AND room_id IS NOT NULL`,
                    [bulkBookingId]
                );

                const roomIds = roomsToFree.rows.map(r => r.room_id).filter(Boolean);
                if (roomIds.length > 0) {
                    await client.query('UPDATE rooms SET status = \'AVAILABLE\' WHERE id = ANY($1)', [roomIds]);
                }
            }

            // If cancelled, free up inventory
            if (newStatus === 'CANCELLED') {
                const childBookings = await client.query('SELECT room_type_id, quantity, check_in_date, check_out_date FROM bookings WHERE bulk_booking_id = $1', [bulkBookingId]);
                for (const b of childBookings.rows) {
                    await client.query(`
                    UPDATE room_inventory
                    SET booked_count = GREATEST(0, booked_count - $1)
                    WHERE hotel_id = $2
                    AND room_type_id = $3
                    AND inventory_date >= $4::date
                    AND inventory_date < $5::date
                  `, [b.quantity || 1, hotelId, b.room_type_id, b.check_in_date, b.check_out_date]);
                }
            }

            await client.query('COMMIT');
            return updateResult.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get combined invoice for a bulk booking
     */
    async getCombinedInvoice(bulkBookingId, hotelId) {
        const bulkRes = await db.query(
            `SELECT bb.*, h.name as hotel_name, h.gst_number as hotel_gst
             FROM bulk_bookings bb
             JOIN hotels h ON h.id = bb.hotel_id
             WHERE bb.id = $1 AND bb.hotel_id = $2`,
            [bulkBookingId, hotelId]
        );
        if (bulkRes.rows.length === 0) throw new Error('Bulk booking not found');
        const bulk = bulkRes.rows[0];

        const childRes = await db.query(
            `SELECT b.booking_ref, b.quantity, b.adults, b.check_in_date, b.check_out_date,
                    rt.name as room_type_name, rt.base_price
             FROM bookings b
             LEFT JOIN room_types rt ON rt.id = b.room_type_id
             WHERE b.bulk_booking_id = $1 AND b.hotel_id = $2
             ORDER BY rt.name`,
            [bulkBookingId, hotelId]
        );

        const checkIn = new Date(bulk.check_in_date);
        const checkOut = new Date(bulk.check_out_date);
        const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

        const lineItems = childRes.rows.map(child => {
            const qty = parseInt(child.quantity) || 1;
            const price = parseFloat(child.base_price) || 0;
            const lineTotal = price * qty * nights;
            return {
                booking_ref: child.booking_ref,
                room_type_name: child.room_type_name,
                quantity: qty,
                adults: child.adults,
                base_price: price,
                nights,
                line_total: lineTotal
            };
        });

        const totalRoomCharge = lineItems.reduce((acc, item) => acc + item.line_total, 0);

        // Custom Billing
        const promoDiscount = bulk.status === 'CANCELLED' ? 0 : (parseFloat(bulk.promo_discount) || 0);
        const extraChargesArray = (bulk.status === 'CANCELLED' || typeof bulk.extra_charges === 'undefined')
            ? []
            : (typeof bulk.extra_charges === 'string' ? JSON.parse(bulk.extra_charges) : (bulk.extra_charges || []));
        const extraTotal = extraChargesArray.reduce((sum, charge) => sum + (parseFloat(charge.amount) || 0), 0);
        const corporateGst = bulk.corporate_gst || null;
        const appliedPromotion = bulk.applied_promotion || null;

        const roomChargeToTax = bulk.status === 'CANCELLED' ? 0 : totalRoomCharge;
        const extraChargeToTax = extraTotal;

        const baseTotal = roomChargeToTax + extraChargeToTax - promoDiscount;

        // Tax calculation
        const settingsService = require('../../settings/services/settings.service');
        const taxes = await settingsService.getTaxes(hotelId);
        const activeTaxes = taxes.filter(t => t.is_active);
        const taxBreakdown = [];

        let roomSubtotal = roomChargeToTax;
        let extraSubtotal = extraChargeToTax;

        activeTaxes.filter(t => t.is_inclusive).forEach(tax => {
            let taxAmount = 0;
            const rate = parseFloat(tax.rate);
            if (tax.category === 'ROOM' || tax.category === 'ALL') {
                const base = roomSubtotal / (1 + rate / 100);
                taxAmount += (roomSubtotal - base);
            }
            if (taxAmount > 0) {
                taxBreakdown.push({ name: tax.name, rate, is_inclusive: true, amount: Number(taxAmount.toFixed(2)) });
            }
        });

        taxBreakdown.forEach(t => { roomSubtotal -= t.amount; });

        activeTaxes.filter(t => !t.is_inclusive).forEach(tax => {
            let taxAmount = 0;
            const rate = parseFloat(tax.rate);
            if (tax.category === 'ROOM' || tax.category === 'ALL') {
                taxAmount += (roomChargeToTax * (rate / 100));
            }
            if (taxAmount > 0) {
                taxBreakdown.push({ name: tax.name, rate, is_inclusive: false, amount: Number(taxAmount.toFixed(2)) });
            }
        });

        const nonInclTaxes = taxBreakdown.filter(t => !t.is_inclusive).reduce((a, t) => a + t.amount, 0);
        const finalTotal = bulk.status === 'CANCELLED' ? 0 : (roomChargeToTax + extraTotal + nonInclTaxes - promoDiscount);

        // Fetch Hotel Settings for Header/Footer (Address, Phone, etc)
        const settingsRes = await db.query('SELECT * FROM hotel_settings WHERE hotel_id = $1', [hotelId]);
        const hotelSettings = settingsRes.rows[0] || {};

        return {
            hotel_name: bulk.hotel_name,
            hotel_gst: bulk.hotel_gst,
            hotel_settings: hotelSettings,
            company_name: bulk.company_name,
            guest_name: bulk.guest_name,
            guest_phone: bulk.guest_phone,
            guest_email: bulk.guest_email,
            check_in_date: bulk.check_in_date,
            check_out_date: bulk.check_out_date,
            adults: bulk.adults,
            children: bulk.children,
            nights,
            status: bulk.status,
            payment_status: bulk.payment_status || 'UNPAID',
            payment_method: bulk.payment_method,
            lineItems: bulk.status === 'CANCELLED' ? lineItems.map(li => ({ ...li, line_total: 0 })) : lineItems,
            totalRoomCharge: bulk.status === 'CANCELLED' ? 0 : totalRoomCharge,
            extraTotal: extraTotal,
            promoDiscount: promoDiscount,
            appliedPromotion,
            corporateGst,
            extraCharges: extraChargesArray,
            taxBreakdown,
            finalTotal,
            paid_amount: parseFloat(bulk.paid_amount) || 0,
            invoice_number: bulk.invoice_number
        };
    }

    /**
     * Update extra charges or billing overrides on a Bulk Booking
     */
    async updateBulkBilling(bulkBookingId, hotelId, updates) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const { promo_discount, applied_promotion, extra_charges, corporate_gst } = updates;

            // Optional update query parts depending on what is sent
            const params = [bulkBookingId, hotelId];
            let setClauses = [];
            let paramIdx = 3;

            if (applied_promotion !== undefined) {
                // If code is provided but no discount, try to validate and auto-calculate
                if (promo_discount === undefined || promo_discount === null) {
                    try {
                        const invoice = await this.getCombinedInvoice(bulkBookingId, hotelId);
                        const validation = await promotionService.validateCoupon(
                            applied_promotion,
                            hotelId,
                            invoice.totalRoomCharge,
                            invoice.nights
                        );
                        if (validation.valid) {
                            setClauses.push(`promo_discount = $${paramIdx++}`);
                            params.push(validation.discount_amount);
                        }
                    } catch (err) {
                        // Throw specific coupon errors back to controller
                        throw err;
                    }
                }
                setClauses.push(`applied_promotion = $${paramIdx++}`);
                params.push(applied_promotion);
            }
            if (promo_discount !== undefined) {
                setClauses.push(`promo_discount = $${paramIdx++}`);
                params.push(promo_discount);
            }
            if (extra_charges !== undefined) {
                setClauses.push(`extra_charges = $${paramIdx++}`);
                params.push(JSON.stringify(extra_charges));
            }
            if (corporate_gst !== undefined) {
                setClauses.push(`corporate_gst = $${paramIdx++}`);
                params.push(corporate_gst);
            }

            if (setClauses.length > 0) {
                const query = `
                    UPDATE bulk_bookings
                    SET ${setClauses.join(', ')}
                    WHERE id = $1 AND hotel_id = $2
                    RETURNING *
                `;
                const bulkRes = await client.query(query, params);

                // Recalculate true `total_amount` after updates
                if (bulkRes.rows.length > 0) {
                    await client.query('COMMIT');
                    // Get latest invoice computation which calculates true taxes and total
                    const latestInvoice = await this.getCombinedInvoice(bulkBookingId, hotelId);
                    await client.query(
                        'UPDATE bulk_bookings SET total_amount = $1 WHERE id = $2',
                        [latestInvoice.finalTotal, bulkBookingId]
                    );
                }
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Check Out Bulk Booking
     */
    async settlePayment(bulkBookingId, hotelId, payment_method) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const invoice = await this.getCombinedInvoice(bulkBookingId, hotelId);
            const balanceDue = Math.max(0, invoice.finalTotal - invoice.paid_amount);

            if (balanceDue > 0) {
                await client.query(
                    `UPDATE bulk_bookings 
                     SET paid_amount = total_amount, 
                         payment_status = 'PAID', 
                         payment_method = $3,
                         status = 'CHECKED_OUT', 
                         updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $1 AND hotel_id = $2`,
                    [bulkBookingId, hotelId, payment_method]
                );
            } else {
                await client.query(
                    `UPDATE bulk_bookings 
                     SET payment_status = 'PAID',
                         payment_method = $3,
                         status = 'CHECKED_OUT', 
                         updated_at = CURRENT_TIMESTAMP 
                     WHERE id = $1 AND hotel_id = $2`,
                    [bulkBookingId, hotelId, payment_method]
                );
            }

            // Update all children status (Redundant but safe)
            await client.query(
                `UPDATE bookings SET status = 'CHECKED_OUT', updated_at = CURRENT_TIMESTAMP WHERE bulk_booking_id = $1 AND hotel_id = $2`,
                [bulkBookingId, hotelId]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new BulkBookingService();
