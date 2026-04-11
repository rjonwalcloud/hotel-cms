const db = require('../../../config/database');

class PolicyService {
  /**
   * Get all policy limits
   */
  async getAllPolicyLimits() {
    const query = `
      SELECT * FROM policy_limits
      ORDER BY scope, key
    `;

    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Get hotel limits
   */
  async getHotelLimits(hotelId) {
    const query = `
      SELECT 
        pl.key,
        pl.scope,
        pl.description,
        pl.default_max_value,
        hl.max_value,
        COALESCE(uc.current_value, 0) as current_value,
        hl.max_value - COALESCE(uc.current_value, 0) as remaining,
        CASE 
          WHEN hl.max_value > 0 THEN 
            ROUND((COALESCE(uc.current_value, 0)::numeric / hl.max_value) * 100, 2)
          ELSE 0 
        END as usage_percentage,
        u.full_name as set_by_name,
        hl.set_at
      FROM hotel_limits hl
      JOIN policy_limits pl ON pl.id = hl.policy_limit_id
      LEFT JOIN usage_counters uc ON uc.hotel_id = hl.hotel_id 
        AND uc.policy_limit_id = hl.policy_limit_id
      LEFT JOIN users u ON u.id = hl.set_by
      WHERE hl.hotel_id = $1
      ORDER BY pl.key
    `;

    const result = await db.query(query, [hotelId]);
    return result.rows;
  }

  /**
   * Set hotel limit (Super Admin only)
   */
  async setHotelLimit(hotelId, limitKey, maxValue, userId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get old limit value
      const oldLimitQuery = `
        SELECT hl.max_value
        FROM hotel_limits hl
        JOIN policy_limits pl ON pl.id = hl.policy_limit_id
        WHERE hl.hotel_id = $1 AND pl.key = $2
      `;
      const oldLimitResult = await client.query(oldLimitQuery, [hotelId, limitKey]);
      const oldValue = oldLimitResult.rows[0]?.max_value;

      // Set or update limit
      const query = `
        INSERT INTO hotel_limits (hotel_id, policy_limit_id, max_value, set_by)
        SELECT $1, pl.id, $3, $4
        FROM policy_limits pl
        WHERE pl.key = $2
        ON CONFLICT (hotel_id, policy_limit_id)
        DO UPDATE SET 
          max_value = $3,
          set_by = $4,
          set_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const result = await client.query(query, [hotelId, limitKey, maxValue, userId]);

      if (result.rows.length === 0) {
        throw new Error(`Policy limit '${limitKey}' not found`);
      }

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'SET_HOTEL_LIMIT',
        entity_type: 'HOTEL_LIMIT',
        entity_id: result.rows[0].id,
        old_data: { limit_key: limitKey, max_value: oldValue },
        new_data: { limit_key: limitKey, max_value: maxValue }
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
   * Get usage statistics for hotel
   */
  async getUsageStats(hotelId) {
    const query = `
      SELECT 
        pl.key,
        pl.description,
        hl.max_value,
        COALESCE(uc.current_value, 0) as current_value,
        hl.max_value - COALESCE(uc.current_value, 0) as remaining,
        CASE 
          WHEN hl.max_value > 0 THEN 
            ROUND((COALESCE(uc.current_value, 0)::numeric / hl.max_value) * 100, 2)
          ELSE 0 
        END as usage_percentage,
        CASE
          WHEN COALESCE(uc.current_value, 0) >= hl.max_value THEN 'EXCEEDED'
          WHEN COALESCE(uc.current_value, 0) >= hl.max_value * 0.9 THEN 'WARNING'
          WHEN COALESCE(uc.current_value, 0) >= hl.max_value * 0.75 THEN 'CAUTION'
          ELSE 'OK'
        END as status
      FROM hotel_limits hl
      JOIN policy_limits pl ON pl.id = hl.policy_limit_id
      LEFT JOIN usage_counters uc ON uc.hotel_id = hl.hotel_id 
        AND uc.policy_limit_id = hl.policy_limit_id
      WHERE hl.hotel_id = $1
      ORDER BY 
        CASE 
          WHEN COALESCE(uc.current_value, 0) >= hl.max_value THEN 1
          WHEN COALESCE(uc.current_value, 0) >= hl.max_value * 0.9 THEN 2
          ELSE 3
        END,
        pl.key
    `;

    const result = await db.query(query, [hotelId]);
    return result.rows;
  }

  /**
   * Reset usage counter (for testing or manual correction)
   */
  async resetUsageCounter(hotelId, limitKey, userId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get old value
      const oldValueQuery = `
        SELECT uc.current_value
        FROM usage_counters uc
        JOIN policy_limits pl ON pl.id = uc.policy_limit_id
        WHERE uc.hotel_id = $1 AND pl.key = $2
      `;
      const oldValueResult = await client.query(oldValueQuery, [hotelId, limitKey]);
      const oldValue = oldValueResult.rows[0]?.current_value || 0;

      // Reset counter
      const query = `
        UPDATE usage_counters uc
        SET current_value = 0, updated_at = CURRENT_TIMESTAMP
        FROM policy_limits pl
        WHERE uc.policy_limit_id = pl.id 
        AND uc.hotel_id = $1 
        AND pl.key = $2
        RETURNING uc.*
      `;

      const result = await client.query(query, [hotelId, limitKey]);

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'RESET_USAGE_COUNTER',
        entity_type: 'USAGE_COUNTER',
        entity_id: result.rows[0]?.id,
        old_data: { limit_key: limitKey, current_value: oldValue },
        new_data: { limit_key: limitKey, current_value: 0 }
      }, client);

      await client.query('COMMIT');
      return { success: true, old_value: oldValue };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get quota summary for all hotels (Super Admin)
   */
  async getQuotaSummaryAllHotels() {
    const query = `
      SELECT 
        h.id as hotel_id,
        h.name as hotel_name,
        pl.key as limit_key,
        pl.description,
        hl.max_value,
        COALESCE(uc.current_value, 0) as current_value,
        CASE 
          WHEN hl.max_value > 0 THEN 
            ROUND((COALESCE(uc.current_value, 0)::numeric / hl.max_value) * 100, 2)
          ELSE 0 
        END as usage_percentage
      FROM hotels h
      LEFT JOIN hotel_limits hl ON hl.hotel_id = h.id
      LEFT JOIN policy_limits pl ON pl.id = hl.policy_limit_id
      LEFT JOIN usage_counters uc ON uc.hotel_id = h.id 
        AND uc.policy_limit_id = hl.policy_limit_id
      WHERE h.is_active = true
      ORDER BY h.name, pl.key
    `;

    const result = await db.query(query);
    
    // Group by hotel
    const groupedResults = {};
    result.rows.forEach(row => {
      if (!groupedResults[row.hotel_id]) {
        groupedResults[row.hotel_id] = {
          hotel_id: row.hotel_id,
          hotel_name: row.hotel_name,
          limits: []
        };
      }
      if (row.limit_key) {
        groupedResults[row.hotel_id].limits.push({
          key: row.limit_key,
          description: row.description,
          max_value: row.max_value,
          current_value: row.current_value,
          usage_percentage: row.usage_percentage
        });
      }
    });

    return Object.values(groupedResults);
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

module.exports = new PolicyService();
