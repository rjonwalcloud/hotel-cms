const db = require('../../../config/database');

class BookingManagerService {
  // ============================================
  // CHANNEL MANAGEMENT
  // ============================================

  async createChannel(channelData, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const { hotel_id, name, channel_type, api_key, api_secret, property_id,
              commission_rate, config } = channelData;

      const result = await client.query(
        `INSERT INTO booking_channels
         (hotel_id, name, channel_type, api_key, api_secret, property_id, commission_rate, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [hotel_id, name, channel_type, api_key || null, api_secret || null,
         property_id || null, commission_rate || 0, JSON.stringify(config || {})]
      );

      await this.createAuditLog({
        hotel_id, user_id: userId,
        action: 'CREATE_CHANNEL',
        entity_type: 'BOOKING_CHANNEL',
        entity_id: result.rows[0].id,
        new_data: { name, channel_type }
      }, client);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.constraint === 'booking_channels_hotel_id_channel_type_key') {
        throw new Error('Channel type already exists for this hotel');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getChannelsByHotel(hotelId) {
    const result = await db.query(
      `SELECT bc.*,
              COUNT(cb.id) as total_bookings,
              COUNT(cb.id) FILTER (WHERE cb.status = 'CONFIRMED') as active_bookings,
              COALESCE(SUM(cb.total_amount) FILTER (WHERE cb.status IN ('CONFIRMED', 'COMPLETED')), 0) as total_revenue,
              COALESCE(SUM(cb.commission_amount) FILTER (WHERE cb.status IN ('CONFIRMED', 'COMPLETED')), 0) as total_commission
       FROM booking_channels bc
       LEFT JOIN channel_bookings cb ON cb.channel_id = bc.id
       WHERE bc.hotel_id = $1
       GROUP BY bc.id
       ORDER BY bc.created_at DESC`,
      [hotelId]
    );
    return result.rows;
  }

  async getChannelById(channelId, hotelId) {
    const result = await db.query(
      'SELECT * FROM booking_channels WHERE id = $1 AND hotel_id = $2',
      [channelId, hotelId]
    );
    if (result.rows.length === 0) {
      throw new Error('Channel not found');
    }
    return result.rows[0];
  }

  async updateChannel(channelId, hotelId, updateData, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const oldResult = await client.query(
        'SELECT * FROM booking_channels WHERE id = $1 AND hotel_id = $2',
        [channelId, hotelId]
      );
      if (oldResult.rows.length === 0) {
        throw new Error('Channel not found');
      }

      const allowedFields = ['name', 'api_key', 'api_secret', 'property_id',
        'is_active', 'commission_rate', 'config'];

      const updates = [];
      const values = [];
      let paramCount = 1;

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          const value = field === 'config' ? JSON.stringify(updateData[field]) : updateData[field];
          updates.push(`${field} = $${paramCount++}`);
          values.push(value);
        }
      });

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(channelId);
      const result = await client.query(
        `UPDATE booking_channels SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      await this.createAuditLog({
        hotel_id: hotelId, user_id: userId,
        action: 'UPDATE_CHANNEL',
        entity_type: 'BOOKING_CHANNEL',
        entity_id: channelId,
        old_data: { name: oldResult.rows[0].name },
        new_data: { name: result.rows[0].name }
      }, client);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async toggleChannelStatus(channelId, hotelId, isActive, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE booking_channels SET is_active = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND hotel_id = $3 RETURNING *`,
        [isActive, channelId, hotelId]
      );

      if (result.rows.length === 0) {
        throw new Error('Channel not found');
      }

      await this.createAuditLog({
        hotel_id: hotelId, user_id: userId,
        action: 'TOGGLE_CHANNEL_STATUS',
        entity_type: 'BOOKING_CHANNEL',
        entity_id: channelId,
        new_data: { is_active: isActive }
      }, client);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteChannel(channelId, hotelId, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT * FROM booking_channels WHERE id = $1 AND hotel_id = $2',
        [channelId, hotelId]
      );
      if (existing.rows.length === 0) {
        throw new Error('Channel not found');
      }

      // Check for active bookings
      const activeBookings = await client.query(
        `SELECT COUNT(*) FROM channel_bookings WHERE channel_id = $1 AND status IN ('PENDING', 'CONFIRMED')`,
        [channelId]
      );

      if (parseInt(activeBookings.rows[0].count) > 0) {
        throw new Error('Cannot delete channel with active bookings');
      }

      await client.query('DELETE FROM booking_channels WHERE id = $1', [channelId]);

      await this.createAuditLog({
        hotel_id: hotelId, user_id: userId,
        action: 'DELETE_CHANNEL',
        entity_type: 'BOOKING_CHANNEL',
        entity_id: channelId,
        old_data: existing.rows[0]
      }, client);

      await client.query('COMMIT');
      return { message: 'Channel deleted' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // CHANNEL BOOKINGS
  // ============================================

  async createChannelBooking(bookingData, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const { channel_id, hotel_id, external_booking_id, channel_type, guest_name,
              guest_email, guest_phone, check_in_date, check_out_date,
              room_count, total_amount, commission_amount, raw_data } = bookingData;

      const result = await client.query(
        `INSERT INTO channel_bookings
         (channel_id, hotel_id, external_booking_id, channel_type, guest_name,
          guest_email, guest_phone, check_in_date, check_out_date,
          room_count, total_amount, commission_amount, status, raw_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', $13)
         RETURNING *`,
        [channel_id, hotel_id, external_booking_id, channel_type, guest_name,
         guest_email, guest_phone, check_in_date, check_out_date,
         room_count || 1, total_amount, commission_amount || 0,
         JSON.stringify(raw_data || {})]
      );

      await this.createAuditLog({
        hotel_id, user_id: userId,
        action: 'CREATE_CHANNEL_BOOKING',
        entity_type: 'CHANNEL_BOOKING',
        entity_id: result.rows[0].id,
        new_data: { external_booking_id, channel_type, guest_name }
      }, client);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getChannelBookings(hotelId, filters = {}) {
    let query = `
      SELECT cb.*, bc.name as channel_name
      FROM channel_bookings cb
      JOIN booking_channels bc ON bc.id = cb.channel_id
      WHERE cb.hotel_id = $1
    `;
    const params = [hotelId];
    let paramCount = 1;

    if (filters.channel_id) {
      paramCount++;
      query += ` AND cb.channel_id = $${paramCount}`;
      params.push(filters.channel_id);
    }

    if (filters.status) {
      paramCount++;
      query += ` AND cb.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.channel_type) {
      paramCount++;
      query += ` AND cb.channel_type = $${paramCount}`;
      params.push(filters.channel_type);
    }

    if (filters.from_date) {
      paramCount++;
      query += ` AND cb.check_in_date >= $${paramCount}`;
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      paramCount++;
      query += ` AND cb.check_out_date <= $${paramCount}`;
      params.push(filters.to_date);
    }

    query += ' ORDER BY cb.created_at DESC';

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(filters.limit));
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  async updateChannelBookingStatus(bookingId, hotelId, status, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const oldResult = await client.query(
        'SELECT * FROM channel_bookings WHERE id = $1 AND hotel_id = $2',
        [bookingId, hotelId]
      );

      if (oldResult.rows.length === 0) {
        throw new Error('Channel booking not found');
      }

      const result = await client.query(
        `UPDATE channel_bookings SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [status, bookingId]
      );

      await this.createAuditLog({
        hotel_id: hotelId, user_id: userId,
        action: 'UPDATE_CHANNEL_BOOKING_STATUS',
        entity_type: 'CHANNEL_BOOKING',
        entity_id: bookingId,
        old_data: { status: oldResult.rows[0].status },
        new_data: { status }
      }, client);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getChannelStats(hotelId) {
    const result = await db.query(
      `SELECT
        bc.channel_type,
        bc.name as channel_name,
        COUNT(cb.id) as total_bookings,
        COUNT(cb.id) FILTER (WHERE cb.status = 'CONFIRMED') as confirmed_bookings,
        COUNT(cb.id) FILTER (WHERE cb.status = 'COMPLETED') as completed_bookings,
        COUNT(cb.id) FILTER (WHERE cb.status = 'CANCELLED') as cancelled_bookings,
        COALESCE(SUM(cb.total_amount), 0) as total_revenue,
        COALESCE(SUM(cb.commission_amount), 0) as total_commission
       FROM booking_channels bc
       LEFT JOIN channel_bookings cb ON cb.channel_id = bc.id
       WHERE bc.hotel_id = $1
       GROUP BY bc.id, bc.channel_type, bc.name
       ORDER BY total_revenue DESC`,
      [hotelId]
    );
    return result.rows;
  }

  async createAuditLog(logData, client) {
    const query = `
      INSERT INTO audit_logs (hotel_id, user_id, action, entity_type, entity_id, old_data, new_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await client.query(query, [
      logData.hotel_id, logData.user_id, logData.action,
      logData.entity_type, logData.entity_id,
      JSON.stringify(logData.old_data || null),
      JSON.stringify(logData.new_data || null)
    ]);
  }
}

module.exports = new BookingManagerService();
