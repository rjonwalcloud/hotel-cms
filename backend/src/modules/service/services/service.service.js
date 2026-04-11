const db = require('../../../config/database');

class ServiceManagementService {
  /**
   * Create service category
   */
  async createCategory(categoryData, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const { name, description, is_restaurant } = categoryData;

      // Check if category exists
      const existingCategory = await client.query(
        'SELECT id FROM service_categories WHERE hotel_id = $1 AND name = $2',
        [hotelId, name]
      );

      if (existingCategory.rows.length > 0) {
        throw new Error('Service category with this name already exists');
      }

      const insertQuery = `
        INSERT INTO service_categories (hotel_id, name, description, is_restaurant)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [hotelId, name, description, is_restaurant || false]);
      const category = result.rows[0];

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'CREATE_SERVICE_CATEGORY',
        entity_type: 'SERVICE_CATEGORY',
        entity_id: category.id,
        new_data: category
      }, client);

      await client.query('COMMIT');
      return category;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all categories for hotel
   */
  async getCategoriesByHotel(hotelId) {
    const query = `
      SELECT 
        sc.*,
        COUNT(si.id) as item_count
      FROM service_categories sc
      LEFT JOIN service_items si ON si.category_id = sc.id
      WHERE sc.hotel_id = $1
      GROUP BY sc.id
      ORDER BY sc.name
    `;

    const result = await db.query(query, [hotelId]);
    return result.rows;
  }

  /**
   * Update category
   */
  async updateCategory(categoryId, updateData, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const oldDataResult = await client.query(
        'SELECT * FROM service_categories WHERE id = $1 AND hotel_id = $2',
        [categoryId, hotelId]
      );

      if (oldDataResult.rows.length === 0) {
        throw new Error('Category not found');
      }

      const updates = [];
      const values = [];
      let paramCount = 1;

      if (updateData.name) {
        updates.push(`name = $${paramCount++}`);
        values.push(updateData.name);
      }

      if (updateData.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(updateData.description);
      }

      if (updateData.is_restaurant !== undefined) {
        updates.push(`is_restaurant = $${paramCount++}`);
        values.push(updateData.is_restaurant);
      }

      if (updateData.is_active !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(updateData.is_active);
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(categoryId, hotelId);

      const updateQuery = `
        UPDATE service_categories 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount++} AND hotel_id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'UPDATE_SERVICE_CATEGORY',
        entity_type: 'SERVICE_CATEGORY',
        entity_id: categoryId,
        old_data: oldDataResult.rows[0],
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

  /**
   * Delete category
   */
  async deleteCategory(categoryId, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if category has items
      const itemCheck = await client.query(
        'SELECT COUNT(*) as count FROM service_items WHERE category_id = $1',
        [categoryId]
      );

      if (parseInt(itemCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete category with existing items');
      }

      const categoryData = await client.query(
        'SELECT * FROM service_categories WHERE id = $1 AND hotel_id = $2',
        [categoryId, hotelId]
      );

      if (categoryData.rows.length === 0) {
        throw new Error('Category not found');
      }

      await client.query('DELETE FROM service_categories WHERE id = $1', [categoryId]);

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'DELETE_SERVICE_CATEGORY',
        entity_type: 'SERVICE_CATEGORY',
        entity_id: categoryId,
        old_data: categoryData.rows[0]
      }, client);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create service item
   */
  async createItem(itemData, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const { category_id, name, description, price, max_quantity, dietary_type } = itemData;

      // Verify category belongs to hotel
      const categoryCheck = await client.query(
        'SELECT id FROM service_categories WHERE id = $1 AND hotel_id = $2',
        [category_id, hotelId]
      );

      if (categoryCheck.rows.length === 0) {
        throw new Error('Category not found or access denied');
      }

      const insertQuery = `
        INSERT INTO service_items (hotel_id, category_id, name, description, price, max_quantity, dietary_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        hotelId, category_id, name, description, price, max_quantity || null, dietary_type || 'ALL'
      ]);

      const item = result.rows[0];

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'CREATE_SERVICE_ITEM',
        entity_type: 'SERVICE_ITEM',
        entity_id: item.id,
        new_data: item
      }, client);

      await client.query('COMMIT');
      return item;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all items for hotel
   */
  async getItemsByHotel(hotelId, filters = {}) {
    let query = `
      SELECT 
        si.*,
        sc.name as category_name
      FROM service_items si
      JOIN service_categories sc ON sc.id = si.category_id
      WHERE si.hotel_id = $1
    `;

    const params = [hotelId];
    let paramCount = 1;

    if (filters.category_id) {
      paramCount++;
      query += ` AND si.category_id = $${paramCount}`;
      params.push(filters.category_id);
    }

    if (filters.is_available !== undefined) {
      paramCount++;
      query += ` AND si.is_available = $${paramCount}`;
      params.push(filters.is_available);
    }

    query += ' ORDER BY sc.name, si.name';

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get item by ID
   */
  async getItemById(itemId, hotelId) {
    const query = `
      SELECT 
        si.*,
        sc.name as category_name,
        sc.description as category_description
      FROM service_items si
      JOIN service_categories sc ON sc.id = si.category_id
      WHERE si.id = $1 AND si.hotel_id = $2
    `;

    const result = await db.query(query, [itemId, hotelId]);

    if (result.rows.length === 0) {
      throw new Error('Service item not found');
    }

    return result.rows[0];
  }

  /**
   * Update service item
   */
  async updateItem(itemId, updateData, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const oldDataResult = await client.query(
        'SELECT * FROM service_items WHERE id = $1 AND hotel_id = $2',
        [itemId, hotelId]
      );

      if (oldDataResult.rows.length === 0) {
        throw new Error('Service item not found');
      }

      const updates = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['name', 'description', 'price', 'is_available', 'max_quantity', 'dietary_type'];

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
      values.push(itemId, hotelId);

      const updateQuery = `
        UPDATE service_items 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount++} AND hotel_id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'UPDATE_SERVICE_ITEM',
        entity_type: 'SERVICE_ITEM',
        entity_id: itemId,
        old_data: oldDataResult.rows[0],
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

  /**
   * Delete service item
   */
  async deleteItem(itemId, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if item has any service requests
      const requestCheck = await client.query(
        'SELECT COUNT(*) as count FROM service_requests WHERE service_item_id = $1',
        [itemId]
      );

      if (parseInt(requestCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete item with existing service requests. Please disable it instead.');
      }

      const itemData = await client.query(
        'SELECT * FROM service_items WHERE id = $1 AND hotel_id = $2',
        [itemId, hotelId]
      );

      if (itemData.rows.length === 0) {
        throw new Error('Service item not found');
      }

      await client.query('DELETE FROM service_items WHERE id = $1', [itemId]);

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'DELETE_SERVICE_ITEM',
        entity_type: 'SERVICE_ITEM',
        entity_id: itemId,
        old_data: itemData.rows[0]
      }, client);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Toggle item availability
   */
  async toggleItemAvailability(itemId, isAvailable, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const oldDataResult = await client.query(
        'SELECT * FROM service_items WHERE id = $1 AND hotel_id = $2',
        [itemId, hotelId]
      );

      if (oldDataResult.rows.length === 0) {
        throw new Error('Service item not found');
      }

      const result = await client.query(
        `UPDATE service_items 
         SET is_available = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [isAvailable, itemId]
      );

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'TOGGLE_ITEM_AVAILABILITY',
        entity_type: 'SERVICE_ITEM',
        entity_id: itemId,
        old_data: { is_available: oldDataResult.rows[0].is_available },
        new_data: { is_available: isAvailable }
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

module.exports = new ServiceManagementService();
