const db = require('../../../config/database');
const crypto = require('crypto');

class CreditNoteService {
  generateRef() {
    return 'CN-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  async create(data, userId, hotelId) {
    const {
      guest_name, guest_phone, guest_email, invoice_pnr,
      comments, amount, paid_via
    } = data;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Try to resolve booking from PNR
      let bookingId = null;
      if (invoice_pnr) {
        const bookingRes = await client.query(
          'SELECT id FROM bookings WHERE (booking_ref = $1 OR invoice_number = $1) AND hotel_id = $2 LIMIT 1',
          [invoice_pnr, hotelId]
        );
        if (bookingRes.rows.length > 0) bookingId = bookingRes.rows[0].id;
      }

      const creditNoteRef = this.generateRef();

      const result = await client.query(`
        INSERT INTO credit_notes (hotel_id, booking_id, credit_note_ref, guest_name, guest_phone, guest_email, invoice_pnr, comments, amount, paid_via, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CREATED', $11)
        RETURNING *
      `, [hotelId, bookingId, creditNoteRef, guest_name, guest_phone || null, guest_email || null, invoice_pnr || null, comments || null, amount, paid_via, userId]);

      const cn = result.rows[0];

      // Get creator name
      const userRes = await client.query('SELECT full_name FROM users WHERE id = $1', [userId]);
      const userName = userRes.rows[0]?.full_name || 'Unknown';

      await client.query(`
        INSERT INTO credit_note_events (credit_note_id, event_type, description, created_by)
        VALUES ($1, 'CREATED', $2, $3)
      `, [cn.id, `Credit note created by ${userName} for ${guest_name} — Amount: ${amount}`, userId]);

      await client.query('COMMIT');
      return cn;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getByHotel(hotelId, filters = {}) {
    let query = `
      SELECT cn.*,
        u_created.full_name as created_by_name,
        u_approved.full_name as approved_by_name,
        b.booking_ref
      FROM credit_notes cn
      LEFT JOIN users u_created ON u_created.id = cn.created_by
      LEFT JOIN users u_approved ON u_approved.id = cn.approved_by
      LEFT JOIN bookings b ON b.id = cn.booking_id
      WHERE cn.hotel_id = $1
    `;
    const params = [hotelId];
    let paramCount = 1;

    if (filters.status) {
      paramCount++;
      query += ` AND cn.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.search) {
      paramCount++;
      query += ` AND (cn.guest_name ILIKE $${paramCount} OR cn.guest_phone ILIKE $${paramCount} OR cn.guest_email ILIKE $${paramCount} OR cn.credit_note_ref ILIKE $${paramCount} OR cn.invoice_pnr ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
    }

    query += ' ORDER BY cn.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  async getById(creditNoteId, hotelId) {
    const cnRes = await db.query(`
      SELECT cn.*,
        u_created.full_name as created_by_name,
        u_created.email as created_by_email,
        u_approved.full_name as approved_by_name,
        b.booking_ref, b.guest_name as booking_guest_name, b.total_amount as booking_amount
      FROM credit_notes cn
      LEFT JOIN users u_created ON u_created.id = cn.created_by
      LEFT JOIN users u_approved ON u_approved.id = cn.approved_by
      LEFT JOIN bookings b ON b.id = cn.booking_id
      WHERE cn.id = $1 AND cn.hotel_id = $2
    `, [creditNoteId, hotelId]);

    if (cnRes.rows.length === 0) throw new Error('Credit note not found');

    const eventsRes = await db.query(`
      SELECT e.*, u.full_name as created_by_name
      FROM credit_note_events e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.credit_note_id = $1
      ORDER BY e.created_at ASC
    `, [creditNoteId]);

    return {
      ...cnRes.rows[0],
      events: eventsRes.rows
    };
  }

  async approve(creditNoteId, userId, hotelId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const cnRes = await client.query(
        'SELECT * FROM credit_notes WHERE id = $1 AND hotel_id = $2 FOR UPDATE',
        [creditNoteId, hotelId]
      );
      if (cnRes.rows.length === 0) throw new Error('Credit note not found');
      if (cnRes.rows[0].status !== 'CREATED') throw new Error('Credit note can only be approved from CREATED status');

      await client.query(
        `UPDATE credit_notes SET status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [userId, creditNoteId]
      );

      const userRes = await client.query('SELECT full_name FROM users WHERE id = $1', [userId]);
      const userName = userRes.rows[0]?.full_name || 'Unknown';

      await client.query(`
        INSERT INTO credit_note_events (credit_note_id, event_type, description, created_by)
        VALUES ($1, 'APPROVED', $2, $3)
      `, [creditNoteId, `Credit note approved by ${userName}`, userId]);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async reject(creditNoteId, userId, hotelId, reason) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const cnRes = await client.query(
        'SELECT * FROM credit_notes WHERE id = $1 AND hotel_id = $2 FOR UPDATE',
        [creditNoteId, hotelId]
      );
      if (cnRes.rows.length === 0) throw new Error('Credit note not found');
      if (cnRes.rows[0].status !== 'CREATED') throw new Error('Credit note can only be rejected from CREATED status');

      await client.query(
        `UPDATE credit_notes SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [creditNoteId]
      );

      const userRes = await client.query('SELECT full_name FROM users WHERE id = $1', [userId]);
      const userName = userRes.rows[0]?.full_name || 'Unknown';

      await client.query(`
        INSERT INTO credit_note_events (credit_note_id, event_type, description, created_by)
        VALUES ($1, 'REJECTED', $2, $3)
      `, [creditNoteId, `Credit note rejected by ${userName}${reason ? ` — Reason: ${reason}` : ''}`, userId]);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new CreditNoteService();
