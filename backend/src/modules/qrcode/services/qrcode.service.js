const db = require('../../../config/database');
const QRCode = require('qrcode');
const crypto = require('crypto');
const taskService = require('../../task/services/task.service');

class QRCodeService {
  /**
   * Find active CHECKED_IN booking for a room
   */
  async findActiveBookingForRoom(roomId, hotelId) {
    const result = await db.query(
      `SELECT b.id, b.booking_ref, b.guest_name, b.guest_email, b.guest_phone,
              b.check_in_date, b.check_out_date
       FROM bookings b
       LEFT JOIN booking_rooms br ON br.booking_id = b.id
       WHERE b.hotel_id = $1
         AND b.status = 'CHECKED_IN'
         AND (br.room_id = $2 OR b.room_id = $2)
       ORDER BY b.check_in_date DESC
       LIMIT 1`,
      [hotelId, roomId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  /**
   * Generate QR code for a room
   */
  async generateQRCode(roomId, hotelId, userId, baseUrl) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Verify room exists and belongs to hotel
      const roomResult = await client.query(
        'SELECT r.*, h.name as hotel_name FROM rooms r JOIN hotels h ON h.id = r.hotel_id WHERE r.id = $1 AND r.hotel_id = $2',
        [roomId, hotelId]
      );

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found');
      }

      const room = roomResult.rows[0];

      // Check if QR code already exists for this room
      const existingQR = await client.query(
        'SELECT * FROM room_qr_codes WHERE room_id = $1',
        [roomId]
      );

      if (existingQR.rows.length > 0) {
        // Regenerate the existing QR code
        const qrToken = existingQR.rows[0].qr_token;
        const qrUrl = `${baseUrl}/room-services/${qrToken}`;
        const qrDataUri = await QRCode.toDataURL(qrUrl, {
          width: 400,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });

        await client.query(
          'UPDATE room_qr_codes SET qr_data = $1, is_active = true, updated_at = CURRENT_TIMESTAMP WHERE room_id = $2 RETURNING *',
          [qrDataUri, roomId]
        );

        await this.createAuditLog({
          hotel_id: hotelId,
          user_id: userId,
          action: 'REGENERATE_QRCODE',
          entity_type: 'QRCODE',
          entity_id: existingQR.rows[0].id,
          new_data: { room_number: room.room_number, qr_token: qrToken }
        }, client);

        await client.query('COMMIT');

        return {
          ...existingQR.rows[0],
          qr_data: qrDataUri,
          room_number: room.room_number,
          hotel_name: room.hotel_name,
          qr_url: qrUrl
        };
      }

      // Generate new QR token
      const qrToken = crypto.randomBytes(16).toString('hex');
      const qrUrl = `${baseUrl}/room-services/${qrToken}`;

      // Generate QR code image as data URI
      const qrDataUri = await QRCode.toDataURL(qrUrl, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });

      // Save to database
      const insertResult = await client.query(
        `INSERT INTO room_qr_codes (room_id, hotel_id, qr_token, qr_data, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [roomId, hotelId, qrToken, qrDataUri]
      );

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'GENERATE_QRCODE',
        entity_type: 'QRCODE',
        entity_id: insertResult.rows[0].id,
        new_data: { room_number: room.room_number, qr_token: qrToken }
      }, client);

      await client.query('COMMIT');

      return {
        ...insertResult.rows[0],
        room_number: room.room_number,
        hotel_name: room.hotel_name,
        qr_url: qrUrl
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all QR codes for a hotel
   */
  async getQRCodesByHotel(hotelId) {
    const result = await db.query(
      `SELECT qr.*, r.room_number, r.floor, r.status as room_status,
              rt.name as room_type_name
       FROM room_qr_codes qr
       JOIN rooms r ON r.id = qr.room_id
       LEFT JOIN room_types rt ON rt.id = r.room_type_id
       WHERE qr.hotel_id = $1
       ORDER BY r.room_number`,
      [hotelId]
    );
    return result.rows;
  }

  /**
   * Get QR code by token (public endpoint for scanning)
   */
  async getByToken(qrToken) {
    const result = await db.query(
      `SELECT qr.id, qr.room_id, qr.hotel_id, qr.qr_token, qr.qr_data, qr.scan_count, qr.is_active,
              r.room_number, r.floor, r.status as room_status,
              h.name as hotel_name, h.phone as hotel_phone,
              h.email as hotel_email, h.address as hotel_address,
              hs.currency_code, hs.currency_symbol
       FROM room_qr_codes qr
       JOIN rooms r ON r.id = qr.room_id
       JOIN hotels h ON h.id = qr.hotel_id
       LEFT JOIN hotel_settings hs ON hs.hotel_id = h.id
       WHERE qr.qr_token = $1 AND qr.is_active = true`,
      [qrToken]
    );

    if (result.rows.length === 0) {
      throw new Error('QR code not found or inactive');
    }

    // Increment scan count
    await db.query(
      'UPDATE room_qr_codes SET scan_count = scan_count + 1, last_scanned_at = CURRENT_TIMESTAMP WHERE qr_token = $1',
      [qrToken]
    );

    return result.rows[0];
  }

  /**
   * Get available services for a room (public endpoint)
   * Now checks for active CHECKED_IN booking before showing services
   */
  async getRoomServices(qrToken) {
    const qrCode = await this.getByToken(qrToken);

    // Check for active booking
    const activeBooking = await this.findActiveBookingForRoom(qrCode.room_id, qrCode.hotel_id);

    if (!activeBooking) {
      return {
        hotel: {
          id: qrCode.hotel_id,
          name: qrCode.hotel_name,
          phone: qrCode.hotel_phone,
          email: qrCode.hotel_email,
          address: qrCode.hotel_address,
          currency_code: qrCode.currency_code,
          currency_symbol: qrCode.currency_symbol
        },
        room: {
          number: qrCode.room_number,
          floor: qrCode.floor
        },
        room_occupied: false,
        services: []
      };
    }

    const services = await db.query(
      `SELECT si.*, sc.name as category_name
       FROM service_items si
       JOIN service_categories sc ON sc.id = si.category_id
       WHERE si.hotel_id = $1 AND si.is_available = true AND sc.is_active = true
       ORDER BY sc.name, si.name`,
      [qrCode.hotel_id]
    );

    return {
      hotel: {
        id: qrCode.hotel_id,
        name: qrCode.hotel_name,
        phone: qrCode.hotel_phone,
        email: qrCode.hotel_email,
        address: qrCode.hotel_address,
        currency_code: qrCode.currency_code,
        currency_symbol: qrCode.currency_symbol
      },
      room: {
        number: qrCode.room_number,
        floor: qrCode.floor
      },
      room_occupied: true,
      booking: {
        booking_ref: activeBooking.booking_ref,
        guest_name: activeBooking.guest_name
      },
      services: services.rows
    };
  }

  /**
   * Create a service request via QR code
   * Now enforces occupancy check and links booking PNR
   */
  async createServiceRequest(qrToken, requestData) {
    const qrCode = await db.query(
      `SELECT qr.*, r.room_number FROM room_qr_codes qr
       JOIN rooms r ON r.id = qr.room_id
       WHERE qr.qr_token = $1 AND qr.is_active = true`,
      [qrToken]
    );

    if (qrCode.rows.length === 0) {
      throw new Error('QR code not found or inactive');
    }

    const qr = qrCode.rows[0];

    // Enforce occupancy: room must have an active CHECKED_IN booking
    const activeBooking = await this.findActiveBookingForRoom(qr.room_id, qr.hotel_id);
    if (!activeBooking) {
      throw new Error('Room is not currently occupied. Service requests are only available during an active stay.');
    }

    const { service_item_id, guest_name, guest_phone, quantity, notes, order_group_id } = requestData;
    const requestedQty = quantity || 1;

    // Verify service item and check max_quantity
    const serviceItem = await db.query(
      `SELECT * FROM service_items WHERE id = $1 AND hotel_id = $2`,
      [service_item_id, qr.hotel_id]
    );

    if (serviceItem.rows.length === 0) {
      throw new Error('Service item not found');
    }

    const item = serviceItem.rows[0];
    if (item.max_quantity !== null && requestedQty > item.max_quantity) {
      throw new Error(`Cannot exceed max quantity of ${item.max_quantity} for ${item.name}`);
    }

    const result = await db.query(
      `INSERT INTO service_requests (
        hotel_id, room_id, qr_code_id, service_item_id, 
        guest_name, guest_phone, quantity, notes, 
        booking_id, booking_ref, order_group_id, 
        status, is_billed, invoice_number, payment_method
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        qr.hotel_id, 
        qr.room_id, 
        qr.id, 
        service_item_id, 
        guest_name, 
        guest_phone, 
        requestedQty, 
        notes, 
        activeBooking.id, 
        activeBooking.booking_ref, 
        order_group_id || null,
        requestData.status || 'PENDING',
        requestData.is_billed || false,
        requestData.invoice_number || null,
        requestData.payment_method || null
      ]
    );

    const sr = result.rows[0];

    // Execute auto-task rules for SR_CREATED
    try {
      const itemInfo = await db.query(
        `SELECT si.name, sc.name as category_name, sc.is_restaurant
         FROM service_items si LEFT JOIN service_categories sc ON sc.id = si.category_id
         WHERE si.id = $1`, [service_item_id]
      );
      const item = itemInfo.rows[0] || {};
      const eventFilter = item.is_restaurant ? 'POS' : 'SERVICE';
      await taskService.executeAutoTasks(hotelId, 'SR_CREATED', {
        booking_id: activeBooking.id,
        guest_name: guest_name,
        room_number: room?.room_number || '',
        service_name: item.name || '',
        service_category: item.category_name || '',
        event_filter: eventFilter
      });
    } catch (e) { /* best-effort */ }

    return sr;
  }

  /**
   * Create a service request directly by staff (no QR token needed)
   */
  async createServiceRequestStaff(data) {
    const {
      hotel_id, room_id, service_item_id, guest_name, guest_phone,
      quantity, notes, booking_id, order_group_id,
      status, is_billed, invoice_number, payment_method
    } = data;

    const result = await db.query(
      `INSERT INTO service_requests (
        hotel_id, room_id, service_item_id,
        guest_name, guest_phone, quantity, notes,
        booking_id, order_group_id,
        status, is_billed, invoice_number, payment_method
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        hotel_id, room_id, service_item_id,
        guest_name, guest_phone, quantity, notes,
        booking_id, order_group_id || null,
        status || 'ACCEPTED',
        is_billed || false,
        invoice_number || null,
        payment_method || null
      ]
    );

    // Execute auto-task rules for SR_CREATED (staff)
    try {
      const itemInfo = await db.query(
        `SELECT si.name, sc.name as category_name, sc.is_restaurant
         FROM service_items si LEFT JOIN service_categories sc ON sc.id = si.category_id
         WHERE si.id = $1`, [service_item_id]
      );
      const item = itemInfo.rows[0] || {};
      const eventFilter = item.is_restaurant ? 'POS' : 'SERVICE';
      const roomInfo = room_id ? await db.query('SELECT room_number FROM rooms WHERE id = $1', [room_id]) : { rows: [] };
      await taskService.executeAutoTasks(hotel_id, 'SR_CREATED', {
        booking_id: booking_id || null,
        guest_name: guest_name || '',
        room_number: roomInfo.rows[0]?.room_number || '',
        service_name: item.name || '',
        service_category: item.category_name || '',
        event_filter: eventFilter
      });
    } catch (e) { /* best-effort */ }

    return result.rows[0];
  }

  /**
   * Get multiple service items by their IDs
   */
  async getServiceItemsByIds(ids) {
    if (!ids || ids.length === 0) return [];
    
    const result = await db.query(
      `SELECT si.*, sc.name as category_name 
       FROM service_items si
       JOIN service_categories sc ON sc.id = si.category_id
       WHERE si.id = ANY($1)`,
      [ids]
    );
    return result.rows;
  }

  /**
   * Get service requests for a hotel
   */
  async getServiceRequests(hotelId, filters = {}) {
    let query = `
      SELECT sr.*, r.room_number, si.name as service_name, si.price as service_price,
             sc.name as category_name, h.name as hotel_name,
             sr.booking_ref, sr.order_group_id
      FROM service_requests sr
      LEFT JOIN rooms r ON r.id = sr.room_id
      JOIN service_items si ON si.id = sr.service_item_id
      JOIN service_categories sc ON sc.id = si.category_id
      JOIN hotels h ON h.id = sr.hotel_id
      WHERE sr.hotel_id = $1
    `;
    const params = [hotelId];
    let paramCount = 1;

    if (filters.status) {
      paramCount++;
      query += ` AND sr.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.room_id) {
      paramCount++;
      query += ` AND sr.room_id = $${paramCount}`;
      params.push(filters.room_id);
    }

    query += ' ORDER BY sr.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Update service request status
   */
  async updateServiceRequestStatus(requestId, status, hotelId, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get current status, existing invoice_number, and group info
      const current = await client.query(
        'SELECT status, invoice_number, booking_id, order_group_id FROM service_requests WHERE id = $1', 
        [requestId]
      );
      if (current.rows.length === 0) throw new Error('Service request not found');
      
      const { status: fromStatus, invoice_number: existingInvoice, booking_id, order_group_id } = current.rows[0];

      // 2. Determine if we need to generate an invoice number
      let invoiceNumber = existingInvoice;
      if (status === 'COMPLETED' && !invoiceNumber) {
        // If part of a group, check if any other item in the group already HAS an invoice number
        if (order_group_id) {
          const groupRes = await client.query(
            'SELECT invoice_number FROM service_requests WHERE order_group_id = $1 AND invoice_number IS NOT NULL LIMIT 1',
            [order_group_id]
          );
          if (groupRes.rows.length > 0) {
            invoiceNumber = groupRes.rows[0].invoice_number;
          }
        }

        // Still no invoice number? Generate NEW
        if (!invoiceNumber) {
          const BookingService = require('../../booking/services/booking.service');
          invoiceNumber = await BookingService.generateInvoiceNumber(hotelId, client);
        }

        // If part of a group, update ALL items in the group with this invoice number if they were already COMPLETED or are being completed
        if (order_group_id) {
            await client.query(
                'UPDATE service_requests SET invoice_number = $1 WHERE order_group_id = $2 AND invoice_number IS NULL',
                [invoiceNumber, order_group_id]
            );
        }
      }

      // 3. Update status and invoice number for CURRENT item
      const result = await client.query(
        `UPDATE service_requests 
         SET status = $1, 
             invoice_number = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND hotel_id = $4
         RETURNING *`,
        [status, invoiceNumber, requestId, hotelId]
      );

      // 4. Log history
      await this.logSRHistory(requestId, fromStatus, status, userId, null, client);

      // 5. Execute auto-task rules for SR status change
      if (status === 'COMPLETED') {
        try {
          const srData = result.rows[0];
          const itemInfo = await client.query(
            `SELECT si.name, sc.name as category_name, sc.is_restaurant
             FROM service_items si LEFT JOIN service_categories sc ON sc.id = si.category_id
             WHERE si.id = $1`, [srData.service_item_id]
          );
          const item = itemInfo.rows[0] || {};
          const eventFilter = item.is_restaurant ? 'POS' : 'SERVICE';
          const roomInfo = srData.room_id ? await client.query('SELECT room_number FROM rooms WHERE id = $1', [srData.room_id]) : { rows: [] };
          await taskService.executeAutoTasks(hotelId, 'SR_COMPLETED', {
            booking_id: srData.booking_id,
            guest_name: srData.guest_name || '',
            room_number: roomInfo.rows[0]?.room_number || '',
            service_name: item.name || '',
            service_category: item.category_name || '',
            event_filter: eventFilter
          }, client);
        } catch (e) { /* best-effort */ }
      }

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
   * Bulk update service request status for multiple items in an order
   */
  async bulkUpdateServiceRequestStatus(updates, hotelId, userId) {
    const results = [];
    for (const update of updates) {
      if (update.id && update.status) {
        const result = await this.updateServiceRequestStatus(update.id, update.status, hotelId, userId);
        results.push(result);
      }
    }
    return results;
  }

  /**
   * Get service request details with history
   */
  async getServiceRequestDetails(requestId) {
    const srQuery = `
      SELECT sr.*, r.room_number, si.name as service_name, si.price as service_price,
             sc.name as category_name, h.name as hotel_name,
             sr.booking_ref
      FROM service_requests sr
      LEFT JOIN rooms r ON r.id = sr.room_id
      JOIN service_items si ON si.id = sr.service_item_id
      JOIN service_categories sc ON sc.id = si.category_id
      JOIN hotels h ON h.id = sr.hotel_id
      WHERE sr.id = $1
    `;
    const srResult = await db.query(srQuery, [requestId]);
    if (srResult.rows.length === 0) throw new Error('Service request not found');

    const historyQuery = `
      SELECT h.*, u.full_name as changed_by_name
      FROM sr_history h
      LEFT JOIN users u ON u.id = h.changed_by
      WHERE h.request_id = $1
      ORDER BY h.changed_at ASC
    `;
    const historyResult = await db.query(historyQuery, [requestId]);

    return { request: srResult.rows[0], history: historyResult.rows };
  }

  /**
   * Log service request history
   */
  async logSRHistory(requestId, fromStatus, toStatus, changedBy, note, client = db) {
    try {
      await client.query(`
        INSERT INTO sr_history (request_id, from_status, to_status, changed_by, note)
        VALUES ($1, $2, $3, $4, $5)
      `, [requestId, fromStatus, toStatus, changedBy || null, note || null]);
    } catch (err) {
      console.error('Failed to log SR history:', err);
    }
  }

  /**
   * Get guest orders for the current stay (public endpoint via QR token)
   * Scoped to active booking_id so history resets after checkout + new checkin
   */
  async getGuestOrders(qrToken) {
    const qrCode = await db.query(
      `SELECT qr.*, r.room_number FROM room_qr_codes qr
       JOIN rooms r ON r.id = qr.room_id
       WHERE qr.qr_token = $1 AND qr.is_active = true`,
      [qrToken]
    );

    if (qrCode.rows.length === 0) {
      throw new Error('QR code not found or inactive');
    }

    const qr = qrCode.rows[0];
    const activeBooking = await this.findActiveBookingForRoom(qr.room_id, qr.hotel_id);

    if (!activeBooking) {
      return { orders: [], room_occupied: false };
    }

    const result = await db.query(
      `SELECT sr.id, sr.quantity, sr.status, sr.notes, sr.created_at, sr.updated_at,
              si.name as service_name, si.price as service_price,
              sc.name as category_name
       FROM service_requests sr
       JOIN service_items si ON si.id = sr.service_item_id
       JOIN service_categories sc ON sc.id = si.category_id
       WHERE sr.booking_id = $1
       ORDER BY sr.created_at DESC`,
      [activeBooking.id]
    );

    return {
      orders: result.rows,
      room_occupied: true,
      booking_ref: activeBooking.booking_ref
    };
  }

  /**
   * Check if a booking has pending service requests (used by checkout guard)
   */
  async getPendingSRCountForBooking(bookingId) {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM service_requests
       WHERE booking_id = $1 AND status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS')`,
      [bookingId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Delete QR code
   */
  async deleteQRCode(qrCodeId, hotelId, userId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT * FROM room_qr_codes WHERE id = $1 AND hotel_id = $2',
        [qrCodeId, hotelId]
      );

      if (existing.rows.length === 0) {
        throw new Error('QR code not found');
      }

      await client.query(
        'UPDATE room_qr_codes SET is_active = false WHERE id = $1',
        [qrCodeId]
      );

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'DEACTIVATE_QRCODE',
        entity_type: 'QRCODE',
        entity_id: qrCodeId,
        old_data: existing.rows[0]
      }, client);

      await client.query('COMMIT');
      return { message: 'QR code deactivated' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk generate QR codes for all rooms in a hotel
   */
  async bulkGenerateQRCodes(hotelId, userId, baseUrl) {
    const rooms = await db.query(
      `SELECT r.id FROM rooms r
       LEFT JOIN room_qr_codes qr ON qr.room_id = r.id
       WHERE r.hotel_id = $1 AND qr.id IS NULL`,
      [hotelId]
    );

    const results = [];
    for (const room of rooms.rows) {
      const qr = await this.generateQRCode(room.id, hotelId, userId, baseUrl);
      results.push(qr);
    }

    return results;
  }

  /**
   * Toggle QR code status
   */
  async toggleQRCodeStatus(qrCodeId, hotelId, isActive, userId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT * FROM room_qr_codes WHERE id = $1 AND hotel_id = $2',
        [qrCodeId, hotelId]
      );

      if (existing.rows.length === 0) {
        throw new Error('QR code not found');
      }

      const result = await client.query(
        'UPDATE room_qr_codes SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [isActive, qrCodeId]
      );

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: isActive ? 'ACTIVATE_QRCODE' : 'DEACTIVATE_QRCODE',
        entity_type: 'QRCODE',
        entity_id: qrCodeId,
        old_data: existing.rows[0],
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

module.exports = new QRCodeService();
