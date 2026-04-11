const db = require('../../../config/database');

class InvoiceController {
  /**
   * Get all booking invoices
   */
  async getBookingInvoices(req, res) {
    try {
      const hotelId = req.query.hotel_id || req.user.hotel_id;
      if (!hotelId) return res.status(400).json({ error: 'Hotel ID is required' });

      const { search, startDate, endDate, paymentStatus, paymentMethod } = req.query;

      let query = `
        SELECT b.id, b.booking_ref, b.invoice_number, b.guest_name, b.payment_status, b.payment_method,
               b.check_in_date, b.check_out_date, b.total_amount, b.room_id, b.status,
               r.room_number,
               b.created_at
        FROM bookings b
        LEFT JOIN rooms r ON r.id = b.room_id
        WHERE b.hotel_id = $1
      `;

      const params = [hotelId];
      let paramCount = 1;

      if (search) {
        paramCount++;
        query += ` AND (b.booking_ref ILIKE $${paramCount} OR b.invoice_number ILIKE $${paramCount} OR b.guest_name ILIKE $${paramCount} OR r.room_number ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (paymentStatus && paymentStatus !== 'ALL') {
        paramCount++;
        query += ` AND b.payment_status = $${paramCount}`;
        params.push(paymentStatus);
      }

      if (paymentMethod && paymentMethod !== 'ALL') {
        paramCount++;
        query += ` AND b.payment_method = $${paramCount}`;
        params.push(paymentMethod);
      }

      if (startDate) {
        paramCount++;
        query += ` AND b.created_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND b.created_at <= $${paramCount}::date + interval '1 day'`;
        params.push(endDate);
      }

      query += ` ORDER BY b.created_at DESC`;

      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching booking invoices:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all service request invoices (completed or with invoice number)
   */
  async getServiceInvoices(req, res) {
    try {
      const hotelId = req.query.hotel_id || req.user.hotel_id;
      if (!hotelId) return res.status(400).json({ error: 'Hotel ID is required' });

      const { search, startDate, endDate, paymentStatus, paymentMethod } = req.query;

      let query = `
        SELECT sr.id, sr.booking_ref, sr.invoice_number, sr.status, sr.is_billed, sr.guest_name,
               sr.quantity, sr.notes, sr.created_at, sr.booking_id, sr.payment_method,
               sr.order_group_id,
               si.name as service_name, si.price as service_price,
               r.room_number,
               b.invoice_number as booking_invoice_ref,
               b.booking_ref as linked_booking_ref,
               sc.is_restaurant
        FROM service_requests sr
        JOIN service_items si ON si.id = sr.service_item_id
        LEFT JOIN service_categories sc ON sc.id = si.category_id
        LEFT JOIN rooms r ON r.id = sr.room_id
        LEFT JOIN bookings b ON b.id = sr.booking_id
        WHERE sr.hotel_id = $1 AND sr.status = 'COMPLETED'
      `;

      const params = [hotelId];
      let paramCount = 1;

      if (search) {
        paramCount++;
        query += ` AND (sr.booking_ref ILIKE $${paramCount} OR sr.invoice_number ILIKE $${paramCount} OR sr.guest_name ILIKE $${paramCount} OR r.room_number ILIKE $${paramCount} OR si.name ILIKE $${paramCount} OR sr.order_group_id::text ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (paymentStatus && paymentStatus !== 'ALL') {
        if (paymentStatus === 'PAID') {
          query += ` AND sr.is_billed = true`;
        } else {
          query += ` AND (sr.is_billed = false OR sr.is_billed IS NULL)`;
        }
      }

      if (paymentMethod && paymentMethod !== 'ALL') {
        paramCount++;
        if (paymentMethod === 'POST_TO_ROOM') {
          query += ` AND sr.payment_method = 'POST_TO_ROOM'`;
        } else {
          query += ` AND sr.payment_method = $${paramCount}`;
          params.push(paymentMethod);
        }
      }

      if (startDate) {
        paramCount++;
        query += ` AND sr.created_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND sr.created_at <= $${paramCount}::date + interval '1 day'`;
        params.push(endDate);
      }

      query += ` ORDER BY sr.created_at DESC`;

      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching service invoices:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all invoices (Bookings + Service Requests + POS) - unified view
   */
  async getAllInvoices(req, res) {
    try {
      const hotelId = req.query.hotel_id || req.user.hotel_id;
      if (!hotelId) return res.status(400).json({ error: 'Hotel ID is required' });

      const { search, startDate, endDate, paymentStatus, paymentMethod, invoiceType } = req.query;

      // Booking invoices
      let bookingQuery = `
        SELECT
          b.id::text as id,
          b.booking_ref::text as reference,
          b.invoice_number::text as invoice_number,
          b.guest_name::text as guest_name,
          b.payment_status::text as payment_status,
          b.payment_method::text as payment_method,
          b.total_amount::numeric as amount,
          r.room_number::text as room_number,
          b.created_at::timestamp as created_at,
          'BOOKING'::text as type,
          NULL::text as paid_via,
          NULL::text as paid_via_ref,
          NULL::text as order_group_id
        FROM bookings b
        LEFT JOIN rooms r ON r.id = b.room_id
        WHERE b.hotel_id = $1 AND b.bulk_booking_id IS NULL
      `;

      // Service request invoices (non-restaurant / QR service)
      let serviceQuery = `
        SELECT
          sr.id::text as id,
          COALESCE(sr.booking_ref, sr.guest_name)::text as reference,
          sr.invoice_number::text as invoice_number,
          sr.guest_name::text as guest_name,
          (CASE WHEN sr.is_billed = true THEN 'PAID' ELSE 'NOT_PAID' END)::text as payment_status,
          sr.payment_method::text as payment_method,
          (sr.quantity * si.price)::numeric as amount,
          r.room_number::text as room_number,
          sr.created_at::timestamp as created_at,
          'SERVICE'::text as type,
          (CASE
            WHEN sr.payment_method = 'POST_TO_ROOM' AND sr.booking_id IS NOT NULL THEN 'BOOKING'
            WHEN sr.booking_id IS NOT NULL AND sr.is_billed = true AND b.invoice_number IS NOT NULL THEN 'BOOKING'
            ELSE NULL
          END)::text as paid_via,
          (CASE
            WHEN sr.payment_method = 'POST_TO_ROOM' AND sr.booking_id IS NOT NULL THEN b.booking_ref
            WHEN sr.booking_id IS NOT NULL AND sr.is_billed = true AND b.invoice_number IS NOT NULL THEN b.booking_ref
            ELSE NULL
          END)::text as paid_via_ref,
          sr.order_group_id::text as order_group_id
        FROM service_requests sr
        JOIN service_items si ON si.id = sr.service_item_id
        LEFT JOIN service_categories sc ON sc.id = si.category_id
        LEFT JOIN rooms r ON r.id = sr.room_id
        LEFT JOIN bookings b ON b.id = sr.booking_id
        WHERE sr.hotel_id = $1
          AND sr.status = 'COMPLETED'
          AND (sc.is_restaurant = false OR sc.is_restaurant IS NULL)
      `;

      // POS / Restaurant invoices (service requests from restaurant categories)
      let posQuery = `
        SELECT
          sr.id::text as id,
          COALESCE(sr.booking_ref, sr.order_group_id::text, sr.guest_name)::text as reference,
          sr.invoice_number::text as invoice_number,
          sr.guest_name::text as guest_name,
          (CASE WHEN sr.is_billed = true THEN 'PAID' ELSE 'NOT_PAID' END)::text as payment_status,
          sr.payment_method::text as payment_method,
          (sr.quantity * si.price)::numeric as amount,
          r.room_number::text as room_number,
          sr.created_at::timestamp as created_at,
          'POS'::text as type,
          (CASE
            WHEN sr.payment_method = 'POST_TO_ROOM' AND sr.booking_id IS NOT NULL THEN 'BOOKING'
            WHEN sr.booking_id IS NOT NULL AND sr.is_billed = true AND b.invoice_number IS NOT NULL THEN 'BOOKING'
            ELSE NULL
          END)::text as paid_via,
          (CASE
            WHEN sr.payment_method = 'POST_TO_ROOM' AND sr.booking_id IS NOT NULL THEN b.booking_ref
            WHEN sr.booking_id IS NOT NULL AND sr.is_billed = true AND b.invoice_number IS NOT NULL THEN b.booking_ref
            ELSE NULL
          END)::text as paid_via_ref,
          sr.order_group_id::text as order_group_id
        FROM service_requests sr
        JOIN service_items si ON si.id = sr.service_item_id
        JOIN service_categories sc ON sc.id = si.category_id AND sc.is_restaurant = true
        LEFT JOIN rooms r ON r.id = sr.room_id
        LEFT JOIN bookings b ON b.id = sr.booking_id
        WHERE sr.hotel_id = $1
          AND sr.status = 'COMPLETED'
      `;

      // Bulk Booking invoices
      let bulkBookingQuery = `
        SELECT
          bb.id::text as id,
          ('Group: ' || bb.id::text)::text as reference,
          bb.invoice_number::text as invoice_number,
          bb.guest_name::text as guest_name,
          bb.payment_status::text as payment_status,
          bb.payment_method::text as payment_method,
          bb.total_amount::numeric as amount,
          'Multiple'::text as room_number,
          bb.created_at::timestamp as created_at,
          'BULK_BOOKING'::text as type,
          NULL::text as paid_via,
          NULL::text as paid_via_ref,
          NULL::text as order_group_id
        FROM bulk_bookings bb
        WHERE bb.hotel_id = $1
      `;

      const params = [hotelId];
      let paramCount = 1;
      let filterSql = "";

      if (search) {
        paramCount++;
        filterSql += ` AND (reference ILIKE $${paramCount} OR invoice_number ILIKE $${paramCount} OR guest_name ILIKE $${paramCount} OR room_number ILIKE $${paramCount} OR order_group_id ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (paymentStatus && paymentStatus !== 'ALL') {
        paramCount++;
        filterSql += ` AND payment_status = $${paramCount}`;
        params.push(paymentStatus);
      }

      if (paymentMethod && paymentMethod !== 'ALL') {
        paramCount++;
        filterSql += ` AND payment_method = $${paramCount}`;
        params.push(paymentMethod);
      }

      if (startDate) {
        paramCount++;
        filterSql += ` AND created_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        filterSql += ` AND created_at <= $${paramCount}::date + interval '1 day'`;
        params.push(endDate);
      }

      // Build query based on type filter
      let unionParts = [];
      if (invoiceType === 'BOOKING') {
        unionParts = [bookingQuery];
      } else if (invoiceType === 'SERVICE') {
        unionParts = [serviceQuery];
      } else if (invoiceType === 'POS') {
        unionParts = [posQuery];
      } else if (invoiceType === 'BULK_BOOKING') {
        unionParts = [bulkBookingQuery];
      } else {
        // Default to ALL
        unionParts = [bookingQuery, serviceQuery, posQuery, bulkBookingQuery];
      }

      const combinedQuery = `
        SELECT * FROM (
          ${unionParts.join(' UNION ALL ')}
        ) as combined_invoices
        WHERE 1=1 ${filterSql}
        ORDER BY created_at DESC
      `;

      const result = await db.query(combinedQuery, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching all invoices:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new InvoiceController();
