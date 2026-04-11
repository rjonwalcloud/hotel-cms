const db = require('../../../config/database');

class RoomTypeService {
    /**
     * Create a new room type
     */
    async createRoomType(data, userId, hotelId) {
        const { name, short_code, description, base_price, max_occupancy, max_adults, max_children, extra_adult_charge, extra_child_charge, amenities } = data;

        const query = `
      INSERT INTO room_types (hotel_id, name, short_code, description, base_price, max_occupancy, max_adults, max_children, extra_adult_charge, extra_child_charge, amenities)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING *
    `;

        const values = [
            hotelId,
            name,
            short_code || null,
            description || null,
            base_price || 0,
            max_occupancy || 2,
            max_adults ?? 2,
            max_children ?? 0,
            extra_adult_charge ?? 500,
            extra_child_charge ?? 200,
            JSON.stringify(amenities || [])
        ];

        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Get all room types for a hotel
     */
    async getRoomTypesByHotel(hotelId) {
        const query = `
      SELECT * FROM room_types 
      WHERE hotel_id = $1 
      ORDER BY name ASC
    `;
        const result = await db.query(query, [hotelId]);
        return result.rows;
    }

    /**
     * Get room type by ID
     */
    async getRoomTypeById(id, hotelId) {
        const query = `
      SELECT * FROM room_types 
      WHERE id = $1 AND hotel_id = $2
    `;
        const result = await db.query(query, [id, hotelId]);

        if (result.rows.length === 0) {
            throw new Error('Room type not found');
        }

        return result.rows[0];
    }

    /**
     * Update room type
     */
    async updateRoomType(id, data, userId, hotelId) {
        const { name, short_code, description, base_price, max_occupancy, max_adults, max_children, extra_adult_charge, extra_child_charge, amenities } = data;

        const query = `
      UPDATE room_types 
      SET name = $1, short_code = $2, description = $3, base_price = $4, 
          max_occupancy = $5, max_adults = $6, max_children = $7, 
          extra_adult_charge = $8, extra_child_charge = $9, amenities = $10::jsonb
      WHERE id = $11 AND hotel_id = $12
      RETURNING *
    `;

        const values = [name, short_code || null, description, base_price, max_occupancy, max_adults ?? 2, max_children ?? 0, extra_adult_charge ?? 500, extra_child_charge ?? 200, JSON.stringify(amenities || []), id, hotelId];
        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            throw new Error('Room type not found or access denied');
        }

        return result.rows[0];
    }

    /**
     * Delete room type
     */
    async deleteRoomType(id, hotelId) {
        // Check if rooms are using this type
        const roomCheck = await db.query(
            'SELECT COUNT(*) as count FROM rooms WHERE room_type_id = $1',
            [id]
        );

        if (parseInt(roomCheck.rows[0].count) > 0) {
            throw new Error('Cannot delete room type because it is being used by rooms');
        }

        const query = 'DELETE FROM room_types WHERE id = $1 AND hotel_id = $2 RETURNING *';
        const result = await db.query(query, [id, hotelId]);

        if (result.rows.length === 0) {
            throw new Error('Room type not found or access denied');
        }

        return true;
    }

    /**
     * Sync inventory for a hotel (creates missing inventory dates)
     */
    async syncInventory(hotelId, days = 365) {
        const query = `
      WITH room_counts AS (
        SELECT room_type_id, COUNT(*) as count 
        FROM rooms 
        WHERE hotel_id = $1 
        GROUP BY room_type_id
      )
      INSERT INTO room_inventory (hotel_id, room_type_id, inventory_date, total_inventory, booked_count) 
      SELECT rt.hotel_id, rt.id, CURRENT_DATE + i, COALESCE(rc.count, 0), 0 
      FROM room_types rt
      LEFT JOIN room_counts rc ON rc.room_type_id = rt.id
      CROSS JOIN generate_series(0, $2::int) i 
      WHERE rt.hotel_id = $1
      ON CONFLICT (hotel_id, room_type_id, inventory_date) 
      DO UPDATE SET total_inventory = EXCLUDED.total_inventory;
    `;
        await db.query(query, [hotelId, parseInt(days)]);

        // Recalculate booked_count accurately to fix any out-of-sync bookings
        const fixBookedQuery = `
      UPDATE room_inventory ri
      SET booked_count = COALESCE((
        SELECT SUM(COALESCE(quantity, 1))
        FROM bookings b 
        WHERE b.hotel_id = ri.hotel_id 
          AND b.room_type_id = ri.room_type_id 
          AND ri.inventory_date >= b.check_in_date 
          AND ri.inventory_date < b.check_out_date 
          AND b.status IN ('CREATED', 'CONFIRMED', 'CHECKED_IN')
      ), 0)
      WHERE hotel_id = $1;
    `;
        const result = await db.query(fixBookedQuery, [hotelId]);
        return result.rowCount;
    }
}

module.exports = new RoomTypeService();
