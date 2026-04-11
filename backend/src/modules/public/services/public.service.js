const db = require('../../../config/database');

class PublicService {

    /**
     * Get basic hotel info
     */
    async getHotelInfo(hotelId) {
        const query = `
      SELECT id, name, address, city, state, country, phone, email, description, logo
      FROM hotels
      WHERE id = $1 AND is_active = true
    `;
        const result = await db.query(query, [hotelId]);
        if (result.rows.length === 0) {
            throw new Error('Hotel not found or inactive');
        }
        return result.rows[0];
    }

    /**
     * Get Availability
     * Finds all room types where available inventory >= requested rooms for all dates in range.
     */
    async searchAvailability(params) {
        const { hotelId, checkIn, checkOut, adults, children, rooms } = params;

        // First fetch all active room types for this hotel
        const roomTypesQuery = `
      SELECT id, name, description, base_price, max_occupancy, amenities
      FROM room_types
      WHERE hotel_id = $1
    `;
        const roomTypesRes = await db.query(roomTypesQuery, [hotelId]);
        const roomTypes = roomTypesRes.rows;

        const availableRoomTypes = [];
        const totalGuests = adults + children;

        for (const rt of roomTypes) {
            // Basic occupancy check per room (assuming totalGuests are distributed evenly)
            if (rt.max_occupancy * rooms < totalGuests) {
                continue; // Not big enough
            }

            // Check Inventory Table
            // We look for any date in the range where (total_inventory - booked_count) < requested rooms
            const inventoryQuery = `
        SELECT MIN(total_inventory - booked_count) as min_available
        FROM room_inventory
        WHERE hotel_id = $1 AND room_type_id = $2
        AND inventory_date >= $3::date AND inventory_date < $4::date
      `;
            const invRes = await db.query(inventoryQuery, [hotelId, rt.id, checkIn, checkOut]);

            let minAvailable = 0;
            if (invRes.rows.length > 0 && invRes.rows[0].min_available !== null) {
                minAvailable = parseInt(invRes.rows[0].min_available);
            } else {
                // If there's no row in room_inventory, it means 0 inventory has been loaded for those dates
                minAvailable = 0;
            }

            if (minAvailable >= rooms) {
                // Calculate price (simplified: base_price * config nights * rooms)
                const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
                const totalPrice = parseFloat(rt.base_price) * nights * rooms;

                availableRoomTypes.push({
                    ...rt,
                    available_count: minAvailable,
                    total_price: totalPrice,
                    nights
                });
            }
        }

        return {
            check_in: checkIn,
            check_out: checkOut,
            available_rooms: availableRoomTypes
        };
    }

    /**
     * Create Booking (Transactional with Inventory Lock)
     */
    async createBooking(data) {
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            const { hotelId, roomTypeId, checkIn, checkOut, guestName, guestEmail, guestPhone, adults, children, roomCount } = data;

            // 1. Lock rows in room_inventory for the exact dates to prevent race conditions
            // We use FOR UPDATE to block concurrent transactions modifying these rows
            const lockQuery = `
        SELECT id, inventory_date, total_inventory, booked_count
        FROM room_inventory
        WHERE hotel_id = $1 AND room_type_id = $2
        AND inventory_date >= $3::date AND inventory_date < $4::date
        FOR UPDATE
      `;
            const lockRes = await client.query(lockQuery, [hotelId, roomTypeId, checkIn, checkOut]);

            const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

            // 2. Validate availability
            if (lockRes.rows.length < nights) {
                throw new Error('Inventory not configured for all requested dates');
            }

            for (const row of lockRes.rows) {
                const available = row.total_inventory - row.booked_count;
                if (available < roomCount) {
                    throw new Error(`Sold out for date: ${row.inventory_date.toISOString().split('T')[0]}`);
                }
            }

            // 3. Decrement Inventory
            const updateInvQuery = `
        UPDATE room_inventory
        SET booked_count = booked_count + $1, updated_at = CURRENT_TIMESTAMP
        WHERE hotel_id = $2 AND room_type_id = $3
        AND inventory_date >= $4::date AND inventory_date < $5::date
      `;
            await client.query(updateInvQuery, [roomCount, hotelId, roomTypeId, checkIn, checkOut]);

            // 4. Calculate pricing
            const rtRes = await client.query('SELECT base_price FROM room_types WHERE id = $1', [roomTypeId]);
            const basePrice = parseFloat(rtRes.rows[0].base_price);
            const totalAmount = basePrice * nights * roomCount;

            // 5. Generate Booking Reference (e.g., WB-XXXXXX)
            const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
            const bookingRef = `WB-${randomStr}`;

            // 6. Insert Booking record
            const insertBookingQuery = `
        INSERT INTO bookings (
          booking_ref, hotel_id, room_type_id, guest_name, guest_email, guest_phone,
          check_in_date, check_out_date, adults, children, quantity, total_amount, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'CONFIRMED')
        RETURNING *
      `;

            const bookingParams = [
                bookingRef, hotelId, roomTypeId, guestName, guestEmail || null, guestPhone,
                checkIn, checkOut, adults, children, roomCount, totalAmount
            ];

            const bookingRes = await client.query(insertBookingQuery, bookingParams);
            const booking = bookingRes.rows[0];

            // 7. Log Timeline Event
            const eventQuery = `INSERT INTO booking_events (booking_id, event_type, description) VALUES ($1, $2, $3)`;
            await client.query(eventQuery, [booking.id, 'CREATED', 'Booking created by customer via public portal']);

            await client.query('COMMIT');
            return booking;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get Booking By Ref
     */
    async getBookingByRef(bookingRef) {
        const query = `
      SELECT b.*, rt.name as room_type_name
      FROM bookings b
      LEFT JOIN room_types rt ON b.room_type_id = rt.id
      WHERE b.booking_ref = $1
    `;
        const res = await db.query(query, [bookingRef]);
        if (res.rows.length === 0) {
            throw new Error('Booking not found');
        }

        const booking = res.rows[0];

        // Fetch Timeline Events
        const eventsQuery = `SELECT event_type, description, created_at FROM booking_events WHERE booking_id = $1 ORDER BY created_at ASC`;
        const eventsRes = await db.query(eventsQuery, [booking.id]);
        booking.events = eventsRes.rows || [];

        return booking;
    }

    /**
     * Cancel Booking (Transactional Inventory Release)
     */
    async cancelBooking(bookingRef, guestEmail) {
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Fetch booking and lock it
            const bookingRes = await client.query('SELECT * FROM bookings WHERE booking_ref = $1 FOR UPDATE', [bookingRef]);
            if (bookingRes.rows.length === 0) {
                throw new Error('Booking not found');
            }

            const booking = bookingRes.rows[0];

            // 2. Auth check
            if (booking.guest_email !== guestEmail) {
                throw new Error('Unauthorized to cancel this booking');
            }

            if (['CANCELLED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW'].includes(booking.status)) {
                throw new Error(`Cannot cancel booking with status: ${booking.status}`);
            }

            // 3. Release Inventory
            const updateInvQuery = `
        UPDATE room_inventory
        SET booked_count = booked_count - $1, updated_at = CURRENT_TIMESTAMP
        WHERE hotel_id = $2 AND room_type_id = $3
        AND inventory_date >= $4::date AND inventory_date < $5::date
      `;
            await client.query(updateInvQuery, [
                booking.quantity || 1,
                booking.hotel_id,
                booking.room_type_id || booking.room_id, // fallback logic
                booking.check_in_date,
                booking.check_out_date
            ]);

            // 4. Update booking status
            await client.query('UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['CANCELLED', booking.id]);

            // 5. Log Timeline Event
            const eventQuery = `INSERT INTO booking_events (booking_id, event_type, description) VALUES ($1, $2, $3)`;
            await client.query(eventQuery, [booking.id, 'CANCELLED_BY_CLIENT', 'Booking cancelled securely by customer via public portal']);

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get Public System Configs (Legal Links)
     */
    async getSystemConfigs() {
        const query = `
      SELECT config_key, config_value 
      FROM system_configs 
      WHERE config_key IN ('terms_of_service_url', 'privacy_policy_url')
    `;
        const res = await db.query(query);
        const configs = {};
        res.rows.forEach(row => {
            configs[row.config_key] = row.config_value;
        });
        return configs;
    }
}

module.exports = new PublicService();
