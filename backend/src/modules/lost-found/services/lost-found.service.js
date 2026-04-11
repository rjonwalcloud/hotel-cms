const db = require('../../../config/database');
const crypto = require('crypto');

class LostFoundService {
  generateRef() {
    return 'LF-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  async create(data, userId, hotelId) {
    const {
      type, location, location_detail, found_lost_date, item_category,
      item_description, item_cost, contact_name, contact_phone,
      contact_email, booking_pnr, notes
    } = data;

    const query = `
      INSERT INTO lost_found_items (
        hotel_id, type, location, location_detail, found_lost_date,
        item_category, item_description, item_cost, contact_name,
        contact_phone, contact_email, booking_pnr, notes, status, reported_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'OPEN', $14)
      RETURNING *
    `;
    const result = await db.query(query, [
      hotelId, type, location, location_detail || null,
      found_lost_date || new Date(), item_category, item_description,
      item_cost || null, contact_name || null, contact_phone || null,
      contact_email || null, booking_pnr || null, notes || null, userId
    ]);
    return result.rows[0];
  }

  async getByHotel(hotelId, filters = {}) {
    let query = `
      SELECT lf.*,
        u_reported.full_name as reported_by_name,
        u_updated.full_name as updated_by_name
      FROM lost_found_items lf
      LEFT JOIN users u_reported ON u_reported.id = lf.reported_by
      LEFT JOIN users u_updated ON u_updated.id = lf.updated_by
      WHERE lf.hotel_id = $1
    `;
    const params = [hotelId];
    let paramCount = 1;

    if (filters.type) {
      paramCount++;
      query += ` AND lf.type = $${paramCount}`;
      params.push(filters.type);
    }

    if (filters.status) {
      paramCount++;
      query += ` AND lf.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.item_category) {
      paramCount++;
      query += ` AND lf.item_category = $${paramCount}`;
      params.push(filters.item_category);
    }

    if (filters.location) {
      paramCount++;
      query += ` AND lf.location = $${paramCount}`;
      params.push(filters.location);
    }

    if (filters.search) {
      paramCount++;
      query += ` AND (lf.item_description ILIKE $${paramCount} OR lf.contact_name ILIKE $${paramCount} OR lf.contact_phone ILIKE $${paramCount} OR lf.booking_pnr ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
    }

    query += ' ORDER BY lf.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  async getById(itemId, hotelId) {
    const result = await db.query(`
      SELECT lf.*,
        u_reported.full_name as reported_by_name,
        u_reported.email as reported_by_email,
        u_updated.full_name as updated_by_name
      FROM lost_found_items lf
      LEFT JOIN users u_reported ON u_reported.id = lf.reported_by
      LEFT JOIN users u_updated ON u_updated.id = lf.updated_by
      WHERE lf.id = $1 AND lf.hotel_id = $2
    `, [itemId, hotelId]);

    if (result.rows.length === 0) throw new Error('Item not found');
    return result.rows[0];
  }

  async update(itemId, data, userId, hotelId) {
    const {
      type, location, location_detail, found_lost_date, item_category,
      item_description, item_cost, contact_name, contact_phone,
      contact_email, booking_pnr, status, notes
    } = data;

    const result = await db.query(`
      UPDATE lost_found_items SET
        type = COALESCE($1, type),
        location = COALESCE($2, location),
        location_detail = $3,
        found_lost_date = COALESCE($4, found_lost_date),
        item_category = COALESCE($5, item_category),
        item_description = COALESCE($6, item_description),
        item_cost = $7,
        contact_name = $8,
        contact_phone = $9,
        contact_email = $10,
        booking_pnr = $11,
        status = COALESCE($12, status),
        notes = $13,
        updated_by = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15 AND hotel_id = $16
      RETURNING *
    `, [
      type, location, location_detail || null, found_lost_date,
      item_category, item_description, item_cost || null,
      contact_name || null, contact_phone || null, contact_email || null,
      booking_pnr || null, status, notes || null, userId, itemId, hotelId
    ]);

    if (result.rows.length === 0) throw new Error('Item not found');
    return result.rows[0];
  }

  async updateStatus(itemId, status, userId, hotelId) {
    const result = await db.query(
      `UPDATE lost_found_items SET status = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND hotel_id = $4 RETURNING *`,
      [status, userId, itemId, hotelId]
    );
    if (result.rows.length === 0) throw new Error('Item not found');
    return result.rows[0];
  }

  async delete(itemId, hotelId) {
    const result = await db.query(
      'DELETE FROM lost_found_items WHERE id = $1 AND hotel_id = $2 RETURNING id',
      [itemId, hotelId]
    );
    if (result.rows.length === 0) throw new Error('Item not found');
    return { success: true };
  }
}

module.exports = new LostFoundService();
