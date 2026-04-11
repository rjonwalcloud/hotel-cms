const db = require('../../../config/database');

class SubscriptionService {
  // ============================================
  // PLAN MANAGEMENT (Super Admin)
  // ============================================

  async createPlan(planData, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const { name, description, price, duration_days, max_hotels, max_rooms_per_hotel,
              max_bookings_per_month, max_staff_per_hotel, features } = planData;

      const result = await client.query(
        `INSERT INTO subscription_plans
         (name, description, price, duration_days, max_hotels, max_rooms_per_hotel,
          max_bookings_per_month, max_staff_per_hotel, features)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [name, description, price, duration_days || 30, max_hotels || 1,
         max_rooms_per_hotel || 50, max_bookings_per_month || 100,
         max_staff_per_hotel || 20, JSON.stringify(features || [])]
      );

      await this.createAuditLog({
        user_id: userId,
        action: 'CREATE_SUBSCRIPTION_PLAN',
        entity_type: 'SUBSCRIPTION_PLAN',
        entity_id: result.rows[0].id,
        new_data: result.rows[0]
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

  async getAllPlans(includeInactive = false) {
    let query = 'SELECT * FROM subscription_plans';
    if (!includeInactive) {
      query += ' WHERE is_active = true';
    }
    query += ' ORDER BY price ASC';

    const result = await db.query(query);
    return result.rows;
  }

  async getPlanById(planId) {
    const result = await db.query(
      'SELECT * FROM subscription_plans WHERE id = $1',
      [planId]
    );
    if (result.rows.length === 0) {
      throw new Error('Plan not found');
    }
    return result.rows[0];
  }

  async updatePlan(planId, updateData, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const oldResult = await client.query(
        'SELECT * FROM subscription_plans WHERE id = $1',
        [planId]
      );
      if (oldResult.rows.length === 0) {
        throw new Error('Plan not found');
      }

      const allowedFields = ['name', 'description', 'price', 'duration_days', 'max_hotels',
        'max_rooms_per_hotel', 'max_bookings_per_month', 'max_staff_per_hotel', 'features', 'is_active'];

      const updates = [];
      const values = [];
      let paramCount = 1;

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          const value = field === 'features' ? JSON.stringify(updateData[field]) : updateData[field];
          updates.push(`${field} = $${paramCount++}`);
          values.push(value);
        }
      });

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(planId);
      const result = await client.query(
        `UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      await this.createAuditLog({
        user_id: userId,
        action: 'UPDATE_SUBSCRIPTION_PLAN',
        entity_type: 'SUBSCRIPTION_PLAN',
        entity_id: planId,
        old_data: oldResult.rows[0],
        new_data: result.rows[0]
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

  // ============================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================

  async activateSubscription(hotelId, planId, userId, autoRenew = false) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify hotel exists
      const hotelResult = await client.query(
        'SELECT * FROM hotels WHERE id = $1',
        [hotelId]
      );
      if (hotelResult.rows.length === 0) {
        throw new Error('Hotel not found');
      }

      // Verify plan exists
      const plan = await this.getPlanById(planId);

      // Cancel existing active subscriptions
      await client.query(
        `UPDATE hotel_subscriptions SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
         WHERE hotel_id = $1 AND status = 'ACTIVE'`,
        [hotelId]
      );

      // Create new subscription
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.duration_days);

      const result = await client.query(
        `INSERT INTO hotel_subscriptions
         (hotel_id, plan_id, status, start_date, end_date, auto_renew, activated_by)
         VALUES ($1, $2, 'ACTIVE', CURRENT_TIMESTAMP, $3, $4, $5)
         RETURNING *`,
        [hotelId, planId, endDate, autoRenew, userId]
      );

      const subscription = result.rows[0];

      // Record history
      await client.query(
        `INSERT INTO subscription_history (subscription_id, action, to_status, changed_by, notes)
         VALUES ($1, 'ACTIVATE', 'ACTIVE', $2, $3)`,
        [subscription.id, userId, `Activated with plan: ${plan.name}`]
      );

      // Update hotel limits based on plan
      await this.updateHotelLimitsFromPlan(hotelId, plan, client);

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'ACTIVATE_SUBSCRIPTION',
        entity_type: 'SUBSCRIPTION',
        entity_id: subscription.id,
        new_data: { plan_name: plan.name, end_date: endDate }
      }, client);

      await client.query('COMMIT');

      return { ...subscription, plan };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async renewSubscription(subscriptionId, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const subResult = await client.query(
        `SELECT hs.*, sp.duration_days, sp.name as plan_name
         FROM hotel_subscriptions hs
         JOIN subscription_plans sp ON sp.id = hs.plan_id
         WHERE hs.id = $1`,
        [subscriptionId]
      );

      if (subResult.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = subResult.rows[0];

      // Extend end date from current end_date or now (whichever is later)
      const currentEnd = new Date(subscription.end_date);
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      const newEndDate = new Date(baseDate);
      newEndDate.setDate(newEndDate.getDate() + subscription.duration_days);

      const result = await client.query(
        `UPDATE hotel_subscriptions
         SET status = 'ACTIVE', end_date = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [newEndDate, subscriptionId]
      );

      await client.query(
        `INSERT INTO subscription_history (subscription_id, action, from_status, to_status, changed_by, notes)
         VALUES ($1, 'RENEW', $2, 'ACTIVE', $3, $4)`,
        [subscriptionId, subscription.status, userId, `Renewed until ${newEndDate.toISOString().split('T')[0]}`]
      );

      await this.createAuditLog({
        hotel_id: subscription.hotel_id,
        user_id: userId,
        action: 'RENEW_SUBSCRIPTION',
        entity_type: 'SUBSCRIPTION',
        entity_id: subscriptionId,
        old_data: { end_date: subscription.end_date },
        new_data: { end_date: newEndDate }
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

  async cancelSubscription(subscriptionId, userId, reason) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const subResult = await client.query(
        'SELECT * FROM hotel_subscriptions WHERE id = $1',
        [subscriptionId]
      );

      if (subResult.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const result = await client.query(
        `UPDATE hotel_subscriptions
         SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [userId, subscriptionId]
      );

      await client.query(
        `INSERT INTO subscription_history (subscription_id, action, from_status, to_status, changed_by, notes)
         VALUES ($1, 'CANCEL', $2, 'CANCELLED', $3, $4)`,
        [subscriptionId, subResult.rows[0].status, userId, reason || 'Cancelled by admin']
      );

      await this.createAuditLog({
        hotel_id: subResult.rows[0].hotel_id,
        user_id: userId,
        action: 'CANCEL_SUBSCRIPTION',
        entity_type: 'SUBSCRIPTION',
        entity_id: subscriptionId,
        old_data: { status: subResult.rows[0].status },
        new_data: { status: 'CANCELLED', reason }
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

  async getHotelSubscription(hotelId) {
    const result = await db.query(
      `SELECT hs.*, sp.name as plan_name, sp.description as plan_description,
              sp.price as plan_price, sp.features as plan_features,
              sp.max_hotels, sp.max_rooms_per_hotel, sp.max_bookings_per_month,
              sp.max_staff_per_hotel,
              u.full_name as activated_by_name
       FROM hotel_subscriptions hs
       JOIN subscription_plans sp ON sp.id = hs.plan_id
       LEFT JOIN users u ON u.id = hs.activated_by
       WHERE hs.hotel_id = $1
       ORDER BY hs.created_at DESC
       LIMIT 1`,
      [hotelId]
    );
    return result.rows[0] || null;
  }

  async getAllSubscriptions(filters = {}) {
    let query = `
      SELECT hs.*, sp.name as plan_name, sp.price as plan_price,
             h.name as hotel_name, u.full_name as activated_by_name
      FROM hotel_subscriptions hs
      JOIN subscription_plans sp ON sp.id = hs.plan_id
      JOIN hotels h ON h.id = hs.hotel_id
      LEFT JOIN users u ON u.id = hs.activated_by
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (filters.status) {
      paramCount++;
      query += ` AND hs.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.hotel_id) {
      paramCount++;
      query += ` AND hs.hotel_id = $${paramCount}`;
      params.push(filters.hotel_id);
    }

    query += ' ORDER BY hs.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  async getSubscriptionHistory(subscriptionId) {
    const result = await db.query(
      `SELECT sh.*, u.full_name as changed_by_name
       FROM subscription_history sh
       LEFT JOIN users u ON u.id = sh.changed_by
       WHERE sh.subscription_id = $1
       ORDER BY sh.created_at DESC`,
      [subscriptionId]
    );
    return result.rows;
  }

  // ============================================
  // HELPERS
  // ============================================

  async updateHotelLimitsFromPlan(hotelId, plan, client) {
    const limitMap = {
      'room_create': plan.max_rooms_per_hotel,
      'user_create': plan.max_staff_per_hotel,
      'booking_create': plan.max_bookings_per_month
    };

    for (const [key, maxValue] of Object.entries(limitMap)) {
      await client.query(
        `UPDATE hotel_limits hl
         SET max_value = $1, set_at = CURRENT_TIMESTAMP
         FROM policy_limits pl
         WHERE hl.policy_limit_id = pl.id
         AND pl.key = $2
         AND hl.hotel_id = $3`,
        [maxValue, key, hotelId]
      );
    }
  }

  async createAuditLog(logData, client) {
    const query = `
      INSERT INTO audit_logs (hotel_id, user_id, action, entity_type, entity_id, old_data, new_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await client.query(query, [
      logData.hotel_id || null, logData.user_id, logData.action,
      logData.entity_type, logData.entity_id,
      JSON.stringify(logData.old_data || null),
      JSON.stringify(logData.new_data || null)
    ]);
  }
}

module.exports = new SubscriptionService();
