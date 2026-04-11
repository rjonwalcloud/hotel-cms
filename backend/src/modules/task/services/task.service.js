const db = require('../../../config/database');

class TaskService {
  /**
   * List all tasks for a hotel
   */
  async listByHotel(hotelId) {
    const query = `
      SELECT t.*,
        COALESCE(t.source, 'MANUAL') as source,
        u_assigned.full_name as assigned_to_name,
        u_assigned.email as assigned_to_email,
        u_created.full_name as created_by_name,
        b.booking_ref
      FROM tasks t
      LEFT JOIN users u_assigned ON u_assigned.id = t.assigned_to
      LEFT JOIN users u_created ON u_created.id = t.created_by
      LEFT JOIN bookings b ON b.id = t.booking_id
      WHERE t.hotel_id = $1
      ORDER BY
        CASE t.priority
          WHEN 'URGENT' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END,
        t.created_at DESC
    `;
    const result = await db.query(query, [hotelId]);
    return result.rows;
  }

  /**
   * List tasks assigned to a specific user
   */
  async listByUser(userId, hotelId) {
    const query = `
      SELECT t.*,
        u_assigned.full_name as assigned_to_name,
        u_created.full_name as created_by_name,
        b.booking_ref
      FROM tasks t
      LEFT JOIN users u_assigned ON u_assigned.id = t.assigned_to
      LEFT JOIN users u_created ON u_created.id = t.created_by
      LEFT JOIN bookings b ON b.id = t.booking_id
      WHERE t.hotel_id = $1 AND t.assigned_to = $2
      ORDER BY
        CASE t.status
          WHEN 'IN_PROGRESS' THEN 1
          WHEN 'PENDING' THEN 2
          WHEN 'COMPLETED' THEN 3
          WHEN 'CANCELLED' THEN 4
        END,
        CASE t.priority
          WHEN 'URGENT' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END,
        t.created_at DESC
    `;
    const result = await db.query(query, [hotelId, userId]);
    return result.rows;
  }

  /**
   * Get a single task by id
   */
  async getById(taskId) {
    const query = `
      SELECT t.*,
        u_assigned.full_name as assigned_to_name,
        u_created.full_name as created_by_name,
        b.booking_ref
      FROM tasks t
      LEFT JOIN users u_assigned ON u_assigned.id = t.assigned_to
      LEFT JOIN users u_created ON u_created.id = t.created_by
      LEFT JOIN bookings b ON b.id = t.booking_id
      WHERE t.id = $1
    `;
    const result = await db.query(query, [taskId]);
    return result.rows[0] || null;
  }

  /**
   * Create a new task
   */
  async create(data) {
    const { hotel_id, title, description, assigned_to, priority, due_date, booking_id, created_by } = data;
    const query = `
      INSERT INTO tasks (hotel_id, title, description, assigned_to, priority, due_date, booking_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await db.query(query, [
      hotel_id, title, description || null, assigned_to || null,
      priority || 'MEDIUM', due_date || null, booking_id || null, created_by
    ]);

    // Log creation as first history entry
    const task = result.rows[0];
    await this.logHistory(task.id, null, 'PENDING', created_by, 'Task created');

    return task;
  }

  /**
   * Full update (HotelAdmin)
   */
  async update(taskId, data, userId) {
    const { title, description, assigned_to, priority, due_date, status } = data;

    // Get current task to track status change
    const currentTask = await this.getById(taskId);
    if (!currentTask) throw new Error('Task not found');

    const query = `
      UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        assigned_to = $3,
        priority = COALESCE($4, priority),
        due_date = $5,
        status = COALESCE($6, status),
        completed_at = ${status === 'COMPLETED' ? 'CURRENT_TIMESTAMP' : 'completed_at'}
      WHERE id = $7
      RETURNING *
    `;
    const result = await db.query(query, [
      title, description, assigned_to || null,
      priority, due_date || null, status, taskId
    ]);
    if (result.rows.length === 0) throw new Error('Task not found');

    // Log status change if status changed
    if (status && status !== currentTask.status) {
      await this.logHistory(taskId, currentTask.status, status, userId, `Status changed by admin`);
    }

    return result.rows[0];
  }

  /**
   * Update status + comments (Staff)
   */
  async updateStatus(taskId, status, comments, userId) {
    const task = await this.getById(taskId);
    if (!task) throw new Error('Task not found');
    if (task.assigned_to && task.assigned_to !== userId) {
      throw new Error('You can only update tasks assigned to you');
    }

    const fromStatus = task.status;

    const query = `
      UPDATE tasks SET
        status = $1,
        comments = COALESCE($2, comments),
        completed_at = ${status === 'COMPLETED' ? 'CURRENT_TIMESTAMP' : 'NULL'}
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query(query, [status, comments || null, taskId]);

    // Log status change with comments
    await this.logHistory(taskId, fromStatus, status, userId, comments || `Status updated to ${status}`);

    return result.rows[0];
  }

  /**
   * Delete a task
   */
  async delete(taskId) {
    const result = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [taskId]);
    if (result.rows.length === 0) throw new Error('Task not found');
    return { success: true };
  }

  /**
   * Get staff users for a hotel (for assignment dropdown)
   */
  async getStaffByHotel(hotelId) {
    const query = `
      SELECT u.id, u.full_name, u.email, r.name as role_name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.hotel_id = $1 AND u.is_active = true
      ORDER BY u.full_name
    `;
    const result = await db.query(query, [hotelId]);
    return result.rows;
  }

  /**
   * Log a history entry for a task
   */
  async logHistory(taskId, fromStatus, toStatus, changedBy, comments) {
    try {
      await db.query(`
        INSERT INTO task_history (task_id, from_status, to_status, changed_by, comments)
        VALUES ($1, $2, $3, $4, $5)
      `, [taskId, fromStatus, toStatus, changedBy, comments || null]);
    } catch (err) {
      console.error('Failed to log task history:', err);
      // Don't throw — history logging should not block the main operation
    }
  }

  /**
   * Get history for a task
   */
  async getHistory(taskId) {
    const query = `
      SELECT th.*,
        u.full_name as changed_by_name
      FROM task_history th
      LEFT JOIN users u ON u.id = th.changed_by
      WHERE th.task_id = $1
      ORDER BY th.changed_at ASC
    `;
    const result = await db.query(query, [taskId]);
    return result.rows;
  }
  // ============================================
  // AUTO-TASK RULES
  // ============================================

  async getAutoRules(hotelId) {
    const query = `
      SELECT r.*, u.full_name as assign_to_name
      FROM task_auto_rules r
      LEFT JOIN users u ON u.id = r.assign_to
      WHERE r.hotel_id = $1
      ORDER BY r.event_type, r.created_at
    `;
    const result = await db.query(query, [hotelId]);
    return result.rows;
  }

  async createAutoRule(data) {
    const { hotel_id, event_type, event_filter, title, description, priority, assign_to, is_active } = data;
    const query = `
      INSERT INTO task_auto_rules (hotel_id, event_type, event_filter, title, description, priority, assign_to, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await db.query(query, [
      hotel_id, event_type, event_filter || null, title,
      description || null, priority || 'MEDIUM', assign_to || null, is_active !== false
    ]);
    return result.rows[0];
  }

  async updateAutoRule(ruleId, data) {
    const { event_type, event_filter, title, description, priority, assign_to, is_active } = data;
    const query = `
      UPDATE task_auto_rules SET
        event_type = $1, event_filter = $2, title = $3, description = $4,
        priority = $5, assign_to = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;
    const result = await db.query(query, [
      event_type, event_filter || null, title, description || null,
      priority || 'MEDIUM', assign_to || null, is_active !== false, ruleId
    ]);
    if (result.rows.length === 0) throw new Error('Rule not found');
    return result.rows[0];
  }

  async toggleAutoRule(ruleId) {
    const result = await db.query(
      'UPDATE task_auto_rules SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [ruleId]
    );
    if (result.rows.length === 0) throw new Error('Rule not found');
    return result.rows[0];
  }

  async deleteAutoRule(ruleId) {
    const result = await db.query('DELETE FROM task_auto_rules WHERE id = $1 RETURNING id', [ruleId]);
    if (result.rows.length === 0) throw new Error('Rule not found');
    return { success: true };
  }

  /**
   * Execute auto-task rules for a given event.
   * Called from booking/SR event points.
   * @param {string} hotelId
   * @param {string} eventType - e.g. 'BOOKING_CHECKIN', 'BOOKING_CHECKOUT', 'BOOKING_CREATED', 'SR_CREATED', 'SR_COMPLETED'
   * @param {object} context - { booking, room_number, guest_name, service_name, service_category, booking_id, etc. }
   * @param {object} client - optional DB client for transactions
   */
  async executeAutoTasks(hotelId, eventType, context = {}, client = db) {
    try {
      // Check global automation toggle
      const settingsRes = await client.query(
        'SELECT task_automation_enabled FROM hotel_settings WHERE hotel_id = $1', [hotelId]
      );
      if (settingsRes.rows.length > 0 && settingsRes.rows[0].task_automation_enabled === false) {
        return;
      }

      // Get active rules for this event
      const rulesRes = await client.query(
        'SELECT * FROM task_auto_rules WHERE hotel_id = $1 AND event_type = $2 AND is_active = true',
        [hotelId, eventType]
      );

      for (const rule of rulesRes.rows) {
        // Check event_filter if set (for SR events - filter by category type)
        if (rule.event_filter && context.event_filter) {
          if (rule.event_filter !== context.event_filter) continue;
        }

        // Replace placeholders in title and description
        const title = this.replacePlaceholders(rule.title, context);
        const description = this.replacePlaceholders(rule.description || '', context);

        await client.query(`
          INSERT INTO tasks (hotel_id, booking_id, title, description, assigned_to, priority, created_by, source)
          VALUES ($1, $2, $3, $4, $5, $6, NULL, 'AUTO')
        `, [
          hotelId,
          context.booking_id || null,
          title,
          description || null,
          rule.assign_to || null,
          rule.priority
        ]);

        // Log creation history
        const taskRes = await client.query(
          'SELECT id FROM tasks WHERE hotel_id = $1 ORDER BY created_at DESC LIMIT 1', [hotelId]
        );
        if (taskRes.rows.length > 0) {
          await client.query(
            'INSERT INTO task_history (task_id, from_status, to_status, changed_by, comments) VALUES ($1, NULL, $2, NULL, $3)',
            [taskRes.rows[0].id, 'PENDING', `Auto-created by rule: ${eventType}`]
          );
        }
      }
    } catch (error) {
      console.error(`Failed to execute auto-tasks for ${eventType}:`, error);
      // Don't throw — auto-task creation should not block the main operation
    }
  }

  /**
   * Replace placeholders like {guest_name}, {room_number}, {service_name} etc.
   */
  replacePlaceholders(template, context) {
    if (!template) return template;
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }
}

module.exports = new TaskService();
