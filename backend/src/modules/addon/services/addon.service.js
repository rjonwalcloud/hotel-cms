const db = require('../../../config/database');

class AddonService {
  async createAddon(addonData, userId, hotelId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const { name, description, price, is_active } = addonData;
      
      const insertQuery = `
        INSERT INTO addons (hotel_id, name, description, price, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await client.query(insertQuery, [hotelId, name, description, price, is_active !== false]);
      const addon = result.rows[0];

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'CREATE_ADDON',
        entity_type: 'ADDON',
        entity_id: addon.id,
        new_data: addon
      }, client);

      await client.query('COMMIT');
      return addon;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAddonsByHotel(hotelId) {
    const query = `SELECT * FROM addons WHERE hotel_id = $1 ORDER BY name ASC`;
    const result = await db.query(query, [hotelId]);
    return result.rows;
  }

  async updateAddon(addonId, updateData, userId, hotelId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const oldDataRes = await client.query('SELECT * FROM addons WHERE id = $1 AND hotel_id = $2', [addonId, hotelId]);
      if (oldDataRes.rows.length === 0) throw new Error('Addon not found');

      const updates = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['name', 'description', 'price', 'is_active'];
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updates.push(`${field} = $${paramCount++}`);
          values.push(updateData[field]);
        }
      });

      if (updates.length === 0) throw new Error('No valid fields to update');
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(addonId, hotelId);

      const updateQuery = `
        UPDATE addons SET ${updates.join(', ')}
        WHERE id = $${paramCount++} AND hotel_id = $${paramCount}
        RETURNING *
      `;
      const result = await client.query(updateQuery, values);

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'UPDATE_ADDON',
        entity_type: 'ADDON',
        entity_id: addonId,
        old_data: oldDataRes.rows[0],
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

  async deleteAddon(addonId, userId, hotelId) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const oldDataRes = await client.query('SELECT * FROM addons WHERE id = $1 AND hotel_id = $2', [addonId, hotelId]);
        if (oldDataRes.rows.length === 0) throw new Error('Addon not found');

        const bookingCheck = await client.query('SELECT COUNT(*) as count FROM booking_addons WHERE addon_id = $1', [addonId]);
        if (parseInt(bookingCheck.rows[0].count) > 0) {
            throw new Error('Cannot delete addon that has been used in bookings. Please mark it as inactive instead.');
        }

        await client.query('DELETE FROM addons WHERE id = $1 AND hotel_id = $2', [addonId, hotelId]);

        await this.createAuditLog({
            hotel_id: hotelId,
            user_id: userId,
            action: 'DELETE_ADDON',
            entity_type: 'ADDON',
            entity_id: addonId,
            old_data: oldDataRes.rows[0]
        }, client);

        await client.query('COMMIT');
        return { success: true };
    } catch(err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
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

module.exports = new AddonService();
