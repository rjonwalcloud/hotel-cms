const db = require('../../../config/database');
const roomTypeService = require('./room-type.service');

class RoomService {
  /**
   * Create a new room
   */
  async createRoom(roomData, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const { room_type_id, room_number, floor, status } = roomData;

      // Check if room number already exists in this hotel
      const existingRoom = await client.query(
        'SELECT id FROM rooms WHERE hotel_id = $1 AND room_number = $2',
        [hotelId, room_number]
      );

      if (existingRoom.rows.length > 0) {
        throw new Error('Room number already exists in this hotel');
      }

      // Insert room
      const insertQuery = `
        INSERT INTO rooms (hotel_id, room_type_id, room_number, floor, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        hotelId,
        room_type_id,
        room_number,
        floor || null,
        status || 'AVAILABLE'
      ];

      const result = await client.query(insertQuery, values);
      const room = result.rows[0];

      // Increment usage counter
      await this.incrementRoomUsage(hotelId, client);

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'CREATE_ROOM',
        entity_type: 'ROOM',
        entity_id: room.id,
        new_data: room
      }, client);

      await client.query('COMMIT');

      // Auto-sync inventory to reflect physical room changes
      await roomTypeService.syncInventory(hotelId);

      return room;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all rooms for a hotel
   */
  async getRoomsByHotel(hotelId, filters = {}) {
    let query = `
      SELECT 
        r.*,
        rt.name as room_type_name,
        rt.short_code as room_type_short_code,
        rt.base_price,
        rt.max_occupancy,
        rt.amenities
      FROM rooms r
      JOIN room_types rt ON rt.id = r.room_type_id
      WHERE r.hotel_id = $1
    `;

    const params = [hotelId];
    let paramCount = 1;

    // Add filters
    if (filters.status) {
      paramCount++;
      query += ` AND r.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.room_type_id) {
      paramCount++;
      query += ` AND r.room_type_id = $${paramCount}`;
      params.push(filters.room_type_id);
    }

    if (filters.floor) {
      paramCount++;
      query += ` AND r.floor = $${paramCount}`;
      params.push(filters.floor);
    }

    query += ' ORDER BY r.room_number';

    const result = await db.query(query, params);
    const rooms = result.rows;

    if (rooms.length > 0) {
      const quoteService = require('../../rate/services/quote.service');
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const quoteCache = {};

      for (let room of rooms) {
        if (!quoteCache[room.room_type_id]) {
          try {
            const quote = await quoteService.getQuote({
              hotel_id: hotelId,
              room_type_id: room.room_type_id,
              check_in: today,
              check_out: tomorrow,
              quantity: 1
            });
            quoteCache[room.room_type_id] = quote.room_subtotal;
          } catch (err) {
            quoteCache[room.room_type_id] = room.base_price;
          }
        }
        room.dynamic_price = quoteCache[room.room_type_id];
      }
    }

    return rooms;
  }

  /**
   * Get single room by ID
   */
  async getRoomById(roomId, hotelId) {
    const query = `
      SELECT 
        r.*,
        rt.name as room_type_name,
        rt.short_code as room_type_short_code,
        rt.description as room_type_description,
        rt.base_price,
        rt.max_occupancy,
        rt.amenities
      FROM rooms r
      JOIN room_types rt ON rt.id = r.room_type_id
      WHERE r.id = $1 AND r.hotel_id = $2
    `;

    const result = await db.query(query, [roomId, hotelId]);

    if (result.rows.length === 0) {
      throw new Error('Room not found or access denied');
    }

    return result.rows[0];
  }

  /**
   * Update room status
   */
  async updateRoomStatus(roomId, status, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Verify room belongs to hotel and get old data
      const verifyQuery = 'SELECT * FROM rooms WHERE id = $1 AND hotel_id = $2';
      const verifyResult = await client.query(verifyQuery, [roomId, hotelId]);

      if (verifyResult.rows.length === 0) {
        throw new Error('Room not found or access denied');
      }

      const oldData = verifyResult.rows[0];

      // Validate status transition
      const validStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'BLOCKED'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Update status
      const updateQuery = `
        UPDATE rooms 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await client.query(updateQuery, [status, roomId]);
      const newData = result.rows[0];

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'UPDATE_ROOM_STATUS',
        entity_type: 'ROOM',
        entity_id: roomId,
        old_data: { status: oldData.status },
        new_data: { status: newData.status }
      }, client);

      await client.query('COMMIT');
      return newData;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update room details
   */
  async updateRoom(roomId, updateData, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get old data
      const oldDataQuery = 'SELECT * FROM rooms WHERE id = $1 AND hotel_id = $2';
      const oldDataResult = await client.query(oldDataQuery, [roomId, hotelId]);

      if (oldDataResult.rows.length === 0) {
        throw new Error('Room not found or access denied');
      }

      const oldData = oldDataResult.rows[0];

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (updateData.room_type_id) {
        updates.push(`room_type_id = $${paramCount++}`);
        values.push(updateData.room_type_id);
      }

      if (updateData.room_number) {
        // Check for duplicate room number
        const dupCheck = await client.query(
          'SELECT id FROM rooms WHERE hotel_id = $1 AND room_number = $2 AND id != $3',
          [hotelId, updateData.room_number, roomId]
        );

        if (dupCheck.rows.length > 0) {
          throw new Error('Room number already exists');
        }

        updates.push(`room_number = $${paramCount++}`);
        values.push(updateData.room_number);
      }

      if (updateData.floor !== undefined) {
        updates.push(`floor = $${paramCount++}`);
        values.push(updateData.floor);
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(roomId, hotelId);

      const updateQuery = `
        UPDATE rooms 
        SET ${updates.join(', ')}
        WHERE id = $${values.length - 1} AND hotel_id = $${values.length}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      const newData = result.rows[0];

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'UPDATE_ROOM',
        entity_type: 'ROOM',
        entity_id: roomId,
        old_data: oldData,
        new_data: newData
      }, client);

      await client.query('COMMIT');

      // Auto-sync inventory to reflect physical room changes (e.g., room_type_id changed)
      await roomTypeService.syncInventory(hotelId);

      return newData;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete room
   */
  async deleteRoom(roomId, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if room has bookings
      const bookingCheck = await client.query(
        'SELECT COUNT(*) as count FROM bookings WHERE room_id = $1',
        [roomId]
      );

      if (parseInt(bookingCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete room with existing bookings');
      }

      // Get room data for audit log
      const roomData = await client.query(
        'SELECT * FROM rooms WHERE id = $1 AND hotel_id = $2',
        [roomId, hotelId]
      );

      if (roomData.rows.length === 0) {
        throw new Error('Room not found or access denied');
      }

      // Delete room
      await client.query('DELETE FROM rooms WHERE id = $1', [roomId]);

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'DELETE_ROOM',
        entity_type: 'ROOM',
        entity_id: roomId,
        old_data: roomData.rows[0]
      }, client);

      // Decrement usage counter
      await this.decrementRoomUsage(hotelId, client);

      await client.query('COMMIT');

      // Auto-sync inventory to reflect physical room changes
      await roomTypeService.syncInventory(hotelId);

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Increment room usage counter
   */
  async incrementRoomUsage(hotelId, client) {
    const query = `
      INSERT INTO usage_counters (hotel_id, policy_limit_id, current_value)
      SELECT $1, pl.id, 1
      FROM policy_limits pl
      WHERE pl.key = 'room_create'
      ON CONFLICT (hotel_id, policy_limit_id) 
      DO UPDATE SET 
        current_value = usage_counters.current_value + 1,
        updated_at = CURRENT_TIMESTAMP
    `;
    await client.query(query, [hotelId]);
  }

  /**
   * Helper: Decrement room usage counter
   */
  async decrementRoomUsage(hotelId, client) {
    const query = `
      UPDATE usage_counters
      SET current_value = GREATEST(current_value - 1, 0),
          updated_at = CURRENT_TIMESTAMP
      WHERE hotel_id = $1 
      AND policy_limit_id = (SELECT id FROM policy_limits WHERE key = 'room_create')
    `;
    await client.query(query, [hotelId]);
  }

  /**
   * Helper: Create audit log
   */
  async createAuditLog(logData, client) {
    const query = `
      INSERT INTO audit_logs (hotel_id, user_id, action, entity_type, entity_id, old_data, new_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await client.query(query, [
      logData.hotel_id,
      logData.user_id,
      logData.action,
      logData.entity_type,
      logData.entity_id,
      JSON.stringify(logData.old_data || null),
      JSON.stringify(logData.new_data || null)
    ]);
  }
}

module.exports = new RoomService();
