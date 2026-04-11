const db = require('../../../config/database');

class HotelService {
  /**
   * Create a new hotel (Super Admin only)
   */
  async createHotel(hotelData, userId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const { name, address, city, state, country, phone, email, description } = hotelData;

      // Generate unique 10-digit alphanumeric HotelID if not provided
      const hotelIdCode = await this._generateUniqueHotelIdCode(client);

      // Insert hotel
      const insertQuery = `
        INSERT INTO hotels (name, address, city, state, country, phone, email, description, hotel_id_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        name, address, city, state, country, phone, email, description, hotelIdCode
      ]);

      const hotel = result.rows[0];

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotel.id,
        user_id: userId,
        action: 'CREATE_HOTEL',
        entity_type: 'HOTEL',
        entity_id: hotel.id,
        new_data: hotel
      }, client);

      // Initialize default limits for the hotel
      await this.initializeDefaultLimits(hotel.id, client);

      await client.query('COMMIT');
      return hotel;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all hotels
   */
  async getAllHotels(filters = {}) {
    let query = `
      SELECT 
        h.*,
        COUNT(DISTINCT r.id) as total_rooms,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status IN ('CREATED', 'CONFIRMED')) as active_bookings
      FROM hotels h
      LEFT JOIN rooms r ON r.hotel_id = h.id
      LEFT JOIN bookings b ON b.hotel_id = h.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (filters.is_active !== undefined) {
      paramCount++;
      query += ` AND h.is_active = $${paramCount}`;
      params.push(filters.is_active);
    }

    if (filters.city) {
      paramCount++;
      query += ` AND h.city ILIKE $${paramCount}`;
      params.push(`%${filters.city}%`);
    }

    if (filters.country) {
      paramCount++;
      query += ` AND h.country ILIKE $${paramCount}`;
      params.push(`%${filters.country}%`);
    }

    query += ` GROUP BY h.id ORDER BY h.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get hotel by ID
   */
  async getHotelById(hotelId) {
    const query = `
      SELECT 
        h.*,
        COUNT(DISTINCT r.id) as total_rooms,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'AVAILABLE') as available_rooms,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status IN ('CREATED', 'CONFIRMED')) as active_bookings,
        COUNT(DISTINCT ur.user_id) as total_staff
      FROM hotels h
      LEFT JOIN rooms r ON r.hotel_id = h.id
      LEFT JOIN bookings b ON b.hotel_id = h.id
      LEFT JOIN user_roles ur ON ur.hotel_id = h.id
      WHERE h.id = $1
      GROUP BY h.id
    `;

    const result = await db.query(query, [hotelId]);

    if (result.rows.length === 0) {
      throw new Error('Hotel not found');
    }

    return result.rows[0];
  }

  /**
   * Update hotel
   */
  async updateHotel(hotelId, updateData, userId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get old data
      const oldDataResult = await client.query('SELECT * FROM hotels WHERE id = $1', [hotelId]);

      if (oldDataResult.rows.length === 0) {
        throw new Error('Hotel not found');
      }

      const oldData = oldDataResult.rows[0];

      // Build update query
      const updates = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['name', 'address', 'city', 'state', 'country', 'phone', 'email', 'description', 'logo'];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updates.push(`${field} = $${paramCount++}`);
          values.push(updateData[field]);
        }
      });

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(hotelId);

      const updateQuery = `
        UPDATE hotels 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      const newData = result.rows[0];

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'UPDATE_HOTEL',
        entity_type: 'HOTEL',
        entity_id: hotelId,
        old_data: oldData,
        new_data: newData
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
   * Activate/Deactivate hotel
   */
  async toggleHotelStatus(hotelId, isActive, userId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const oldDataResult = await client.query('SELECT * FROM hotels WHERE id = $1', [hotelId]);

      if (oldDataResult.rows.length === 0) {
        throw new Error('Hotel not found');
      }

      const result = await client.query(
        'UPDATE hotels SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [isActive, hotelId]
      );

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'TOGGLE_HOTEL_STATUS',
        entity_type: 'HOTEL',
        entity_id: hotelId,
        old_data: { is_active: oldDataResult.rows[0].is_active },
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

  /**
   * Get hotel statistics
   */
  async getHotelStats(hotelId) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM rooms WHERE hotel_id = $1) as total_rooms,
        (SELECT COUNT(*) FROM rooms WHERE hotel_id = $1 AND status = 'AVAILABLE') as available_rooms,
        (SELECT COUNT(*) FROM rooms WHERE hotel_id = $1 AND status = 'OCCUPIED') as occupied_rooms,
        (SELECT COUNT(*) FROM rooms WHERE hotel_id = $1 AND status = 'MAINTENANCE') as maintenance_rooms,
        (SELECT COUNT(*) FROM bookings WHERE hotel_id = $1) as total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE hotel_id = $1 AND status IN ('CREATED', 'CONFIRMED')) as active_bookings,
        (SELECT COUNT(*) FROM bookings WHERE hotel_id = $1 AND status = 'CHECKED_IN') as checked_in,
        (SELECT COUNT(*) FROM user_roles WHERE hotel_id = $1) as total_staff,
        (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE hotel_id = $1 AND status != 'CANCELLED')
          - (SELECT COALESCE(SUM(amount), 0) FROM credit_notes WHERE hotel_id = $1 AND status = 'APPROVED') as total_revenue,
        (SELECT COALESCE(SUM(paid_amount), 0) FROM bookings WHERE hotel_id = $1 AND status != 'CANCELLED')
          - (SELECT COALESCE(SUM(amount), 0) FROM credit_notes WHERE hotel_id = $1 AND status = 'APPROVED') as paid_revenue,
        (SELECT COUNT(*) FROM credit_notes WHERE hotel_id = $1 AND status = 'CREATED') as pending_credit_notes,
        (SELECT COALESCE(SUM(amount), 0) FROM credit_notes WHERE hotel_id = $1 AND status = 'APPROVED') as total_refunds,
        
        -- Service Requests Stats
        (SELECT COUNT(*) FROM service_requests WHERE hotel_id = $1 AND status = 'PENDING') as pending_services,
        (SELECT COUNT(*) FROM service_requests WHERE hotel_id = $1 AND status = 'ACCEPTED') as accepted_services,
        (SELECT COUNT(*) FROM service_requests WHERE hotel_id = $1 AND status = 'IN_PROGRESS') as in_progress_services,
        (SELECT COUNT(*) FROM service_requests WHERE hotel_id = $1 AND status = 'COMPLETED') as completed_services,

        -- Subscription & Limits
        (
          SELECT json_build_object(
            'status', hs.status,
            'plan_name', sp.name,
            'end_date', hs.end_date,
            'days_left', DATE_PART('day', hs.end_date - CURRENT_TIMESTAMP),
            'max_rooms', sp.max_rooms_per_hotel,
            'max_bookings', sp.max_bookings_per_month
          )
          FROM hotel_subscriptions hs
          JOIN subscription_plans sp ON sp.id = hs.plan_id
          WHERE hs.hotel_id = $1 AND hs.status = 'ACTIVE'
          ORDER BY hs.created_at DESC LIMIT 1
        ) as subscription
    `;

    const result = await db.query(query, [hotelId]);
    return result.rows[0];
  }

  /**
   * Initialize default limits for new hotel
   */
  async initializeDefaultLimits(hotelId, client) {
    const query = `
      INSERT INTO hotel_limits (hotel_id, policy_limit_id, max_value)
      SELECT $1, id, default_max_value
      FROM policy_limits
      WHERE scope = 'HOTEL'
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

  /**
   * Internal: Generate a unique 10-digit alphanumeric HotelID
   */
  async _generateUniqueHotelIdCode(client) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let isUnique = false;
    let code = '';

    while (!isUnique) {
      code = Array.from({ length: 10 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
      const check = await client.query('SELECT 1 FROM hotels WHERE hotel_id_code = $1', [code]);
      if (check.rows.length === 0) {
        isUnique = true;
      }
    }

    return code;
  }
}

module.exports = new HotelService();
