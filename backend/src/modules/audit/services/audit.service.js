const db = require('../../../config/database');

class AuditService {
  /**
   * Get audit logs for hotel
   */
  async getAuditLogsByHotel(hotelId, filters = {}) {
    let query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.hotel_id = $1
    `;

    const params = [hotelId];
    let paramCount = 1;

    if (filters.user_id) {
      paramCount++;
      query += ` AND al.user_id = $${paramCount}`;
      params.push(filters.user_id);
    }

    if (filters.action) {
      paramCount++;
      query += ` AND al.action = $${paramCount}`;
      params.push(filters.action);
    }

    if (filters.entity_type) {
      paramCount++;
      query += ` AND al.entity_type = $${paramCount}`;
      params.push(filters.entity_type);
    }

    if (filters.entity_id) {
      paramCount++;
      query += ` AND al.entity_id = $${paramCount}`;
      params.push(filters.entity_id);
    }

    if (filters.from_date) {
      paramCount++;
      query += ` AND al.created_at >= $${paramCount}`;
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      paramCount++;
      query += ` AND al.created_at <= $${paramCount}`;
      params.push(filters.to_date);
    }

    // Pagination
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(logId, hotelId) {
    const query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.id = $1 AND al.hotel_id = $2
    `;

    const result = await db.query(query, [logId, hotelId]);

    if (result.rows.length === 0) {
      throw new Error('Audit log not found');
    }

    return result.rows[0];
  }

  /**
   * Get audit logs for specific entity
   */
  async getEntityHistory(entityType, entityId, hotelId) {
    const query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.entity_type = $1 
      AND al.entity_id = $2 
      AND al.hotel_id = $3
      ORDER BY al.created_at DESC
    `;

    const result = await db.query(query, [entityType, entityId, hotelId]);
    return result.rows;
  }

  /**
   * Get audit statistics for hotel
   */
  async getAuditStats(hotelId, fromDate = null, toDate = null) {
    let query = `
      SELECT 
        action,
        entity_type,
        COUNT(*) as count
      FROM audit_logs
      WHERE hotel_id = $1
    `;

    const params = [hotelId];
    let paramCount = 1;

    if (fromDate) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(fromDate);
    }

    if (toDate) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(toDate);
    }

    query += ` GROUP BY action, entity_type ORDER BY count DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get user activity logs
   */
  async getUserActivity(userId, hotelId, limit = 50) {
    const query = `
      SELECT 
        al.*
      FROM audit_logs al
      WHERE al.user_id = $1 AND al.hotel_id = $2
      ORDER BY al.created_at DESC
      LIMIT $3
    `;

    const result = await db.query(query, [userId, hotelId, limit]);
    return result.rows;
  }

  /**
   * Get all audit logs (Super Admin only)
   */
  async getAllAuditLogs(filters = {}) {
    let query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        h.name as hotel_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN hotels h ON h.id = al.hotel_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (filters.hotel_id) {
      paramCount++;
      query += ` AND al.hotel_id = $${paramCount}`;
      params.push(filters.hotel_id);
    }

    if (filters.user_id) {
      paramCount++;
      query += ` AND al.user_id = $${paramCount}`;
      params.push(filters.user_id);
    }

    if (filters.action) {
      paramCount++;
      query += ` AND al.action = $${paramCount}`;
      params.push(filters.action);
    }

    if (filters.from_date) {
      paramCount++;
      query += ` AND al.created_at >= $${paramCount}`;
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      paramCount++;
      query += ` AND al.created_at <= $${paramCount}`;
      params.push(filters.to_date);
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Export audit logs to CSV format (data only, actual CSV formatting done in controller)
   */
  async exportAuditLogs(hotelId, fromDate, toDate) {
    const query = `
      SELECT 
        al.created_at,
        u.full_name as user_name,
        u.email as user_email,
        al.action,
        al.entity_type,
        al.entity_id,
        al.old_data,
        al.new_data,
        al.ip_address
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.hotel_id = $1
      AND al.created_at >= $2
      AND al.created_at <= $3
      ORDER BY al.created_at DESC
    `;

    const result = await db.query(query, [hotelId, fromDate, toDate]);
    return result.rows;
  }

  /**
   * Export all audit logs (Super Admin)
   */
  async exportAllAuditLogs(filters = {}) {
    let query = `
      SELECT 
        al.created_at,
        u.full_name as user_name,
        u.email as user_email,
        h.name as hotel_name,
        al.action,
        al.entity_type,
        al.entity_id,
        al.old_data,
        al.new_data,
        al.ip_address
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN hotels h ON h.id = al.hotel_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (filters.action) {
      paramCount++;
      query += ` AND al.action = $${paramCount}`;
      params.push(filters.action);
    }

    if (filters.entity_type) {
      paramCount++;
      query += ` AND al.entity_type = $${paramCount}`;
      params.push(filters.entity_type);
    }

    if (filters.from_date) {
      paramCount++;
      query += ` AND al.created_at >= $${paramCount}`;
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      paramCount++;
      query += ` AND al.created_at <= $${paramCount}`;
      params.push(filters.to_date);
    }

    query += ` ORDER BY al.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = new AuditService();
