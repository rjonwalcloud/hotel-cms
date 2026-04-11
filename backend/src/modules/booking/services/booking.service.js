const db = require('../../../config/database');
const settingsService = require('../../settings/services/settings.service');
const taskService = require('../../task/services/task.service');

class BookingService {
  // Booking state machine transitions
  VALID_TRANSITIONS = {
    'CREATED': ['CONFIRMED', 'CHECKED_IN', 'CANCELLED'],
    'CONFIRMED': ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
    'CHECKED_IN': ['CHECKED_OUT'],
    'CHECKED_OUT': ['REFUNDED'],
    'CANCELLED': ['REFUNDED'],
    'NO_SHOW': [],
    'REFUNDED': []
  };

  /**
   * Helper to generate a formatted invoice number
   */
  async generateInvoiceNumber(hotelId, client = db) {
    // 1. Get/Create hotel initials
    const hotelRes = await client.query('SELECT name FROM hotels WHERE id = $1', [hotelId]);
    if (hotelRes.rows.length === 0) throw new Error('Hotel not found');
    const hotelName = hotelRes.rows[0].name;

    // 2. Ensure hotel_settings exists and increment counter atomically
    const settingsRes = await client.query(`
      INSERT INTO hotel_settings (hotel_id, invoice_counter)
      VALUES ($1, 1)
      ON CONFLICT (hotel_id) 
      DO UPDATE SET invoice_counter = hotel_settings.invoice_counter + 1
      RETURNING invoice_counter, invoice_prefix
    `, [hotelId]);

    const counter = settingsRes.rows[0].invoice_counter;
    let prefix = settingsRes.rows[0].invoice_prefix;

    if (!prefix) {
      // Generate initials from name (e.g. "Grand Royale Hotel" -> "GRH")
      prefix = hotelName.split(' ').map(word => word[0].toUpperCase()).join('').substring(0, 5);
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const paddedCounter = String(counter).padStart(4, '0');

    // Format: PREFIX/inv/YEAR/MONTH/COUNTER (4-digit padding)
    const invoiceNumber = `${prefix}/inv/${year}/${month}/${paddedCounter}`;

    return invoiceNumber;
  }

  /**
   * Create a new booking
   */
  async createBooking(bookingData, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const {
        room_type_id,
        quantity = 1,
        guest_name,
        guest_email,
        guest_phone,
        check_in_date,
        check_out_date,
        adults,
        children,
        total_amount,
        addons
      } = bookingData;

      if (!room_type_id) {
        throw new Error('Room type is required');
      }

      // Validate dates
      const checkInDate = new Date(check_in_date);
      const checkOutDate = new Date(check_out_date);

      if (checkInDate >= checkOutDate) {
        throw new Error('Check-out date must be after check-in date');
      }

      // Check availability and calculate total amount if not provided
      let calculatedTotal = 0;
      const nights = Math.max(1, Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));

      const availability = await this.checkRoomTypeAvailability(
        room_type_id,
        hotelId,
        check_in_date,
        check_out_date,
        client
      );

      if (availability.remaining < quantity) {
        console.log(`⚠️  Insufficient availability for room_type_id: ${room_type_id}. Required: ${quantity}, Remaining: ${availability.remaining}`);
        throw new Error('Selected room type is not available for selected dates');
      }

      const { formatDate } = require('../../../utils/dateUtils');
      const quoteService = require('../../rate/services/quote.service');
      const quote = await quoteService.getQuote({
        hotel_id: hotelId,
        room_type_id: room_type_id,
        check_in: formatDate(check_in_date),
        check_out: formatDate(check_out_date),
        quantity: quantity,
        adults: adults || 1,
        children: children || 0
      });
      calculatedTotal = quote.final_total;
      const promoDiscount = quote.promo_discount || 0;
      const appliedPromo = quote.applied_promotion?.name || null;
      const ratePlan = quote.rate_plan || null;
      const rateRule = quote.rate_rule || null;
      const roomRate = quote.rate_per_night;
      const roomSubtotal = quote.room_subtotal;
      const occupancySurcharge = quote.occupancy_surcharge || 0;

      // Calculate Addons
      let addonsTotal = 0;
      let validAddons = [];
      if (addons && Array.isArray(addons) && addons.length > 0) {
        const addonIds = addons.map(a => a.addon_id).filter(id => id);
        if (addonIds.length > 0) {
          const addonsRes = await client.query('SELECT id, price FROM addons WHERE id = ANY($1) AND hotel_id = $2', [addonIds, hotelId]);
          const dbAddons = new Map(addonsRes.rows.map(a => [a.id, a.price]));
          for (const addon of addons) {
            if (dbAddons.has(addon.addon_id)) {
              const price = parseFloat(dbAddons.get(addon.addon_id));
              const qty = parseInt(addon.quantity) || 1;
              addonsTotal += (price * qty);
              validAddons.push({ addon_id: addon.addon_id, quantity: qty, price_at_booking: price, total_price: price * qty });
            }
          }
        }
      }

      // Fetch user name
      const userRes = await client.query('SELECT full_name FROM users WHERE id = $1', [userId]);
      const userName = userRes.rows.length > 0 ? userRes.rows[0].full_name : 'Staff';

      // Generate Booking Reference (e.g., HB-XXXXXX, FB-XXXXXX)
      let prefix = 'HB-'; // Default for Hotel staff
      if (bookingData.source === 'FRONT_DESK') prefix = 'FB-';
      else if (bookingData.source === 'WEBSITE') prefix = 'WB-';
      else if (bookingData.source && bookingData.source !== 'HOTEL') prefix = 'OB-';

      const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      const bookingRef = `${prefix}${randomStr}`;

      const insertQuery = `
        INSERT INTO bookings (
          booking_ref, hotel_id, guest_name, guest_email, guest_phone,
          check_in_date, check_out_date, adults, children, total_amount,
          status, created_by, room_type_id, quantity,
          promo_discount, applied_promotion, rate_plan_name, rate_rule_name,
          room_rate, room_subtotal, occupancy_surcharge
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CREATED', $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        bookingRef, hotelId, guest_name, guest_email, guest_phone,
        check_in_date, check_out_date, adults || 1, children || 0,
        total_amount || (calculatedTotal + addonsTotal), userId, room_type_id, quantity,
        promoDiscount, appliedPromo, ratePlan, rateRule,
        roomRate, roomSubtotal, occupancySurcharge
      ]);

      const booking = result.rows[0];

      // Insert addons
      if (validAddons.length > 0) {
        for (const addon of validAddons) {
          await client.query(`
            INSERT INTO booking_addons (booking_id, addon_id, quantity, price_at_booking, total_price)
            VALUES ($1, $2, $3, $4, $5)
          `, [booking.id, addon.addon_id, addon.quantity, addon.price_at_booking, addon.total_price]);
        }
      }

      // Create status history
      await this.createStatusHistory(
        booking.id,
        null,
        'CREATED',
        userId,
        'Booking created (Room assignment deferred)',
        client
      );

      // Increment usage counter
      await this.incrementBookingUsage(hotelId, client);

      // Increment Inventory
      await client.query(`
        UPDATE room_inventory
        SET booked_count = booked_count + $1
        WHERE hotel_id = $2
        AND room_type_id = $3
        AND inventory_date >= $4::date
        AND inventory_date < $5::date
      `, [quantity, hotelId, room_type_id, check_in_date, check_out_date]);

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'CREATE_BOOKING',
        entity_type: 'BOOKING',
        entity_id: booking.id,
        new_data: { ...booking }
      }, client);

      // Log Timeline Event
      await client.query(
        `INSERT INTO booking_events (booking_id, event_type, description) VALUES ($1, $2, $3)`,
        [booking.id, 'CREATED', `Booking created manually by ${userName}`]
      );

      // Execute auto-task rules for BOOKING_CREATED
      await taskService.executeAutoTasks(hotelId, 'BOOKING_CREATED', {
        booking_id: booking.id,
        guest_name: booking.guest_name,
        booking_ref: booking.booking_ref,
        room_number: booking.room_number || ''
      }, client);

      await client.query('COMMIT');
      return booking;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a Front Booking (walk-in guest) - creates booking as CHECKED_IN with immediate room assignment
   */
  async createFrontBooking(bookingData, userId, hotelId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const {
        room_type_id, room_ids = [], guest_name, guest_email, guest_phone,
        check_in_date, check_out_date, adults, children, addons, guest_details = []
      } = bookingData;

      if (!room_type_id) throw new Error('Room type is required');
      if (!room_ids.length) throw new Error('At least one room must be selected for front booking');

      const quantity = room_ids.length;
      const checkInDate = new Date(check_in_date);
      const checkOutDate = new Date(check_out_date);
      if (checkInDate >= checkOutDate) throw new Error('Check-out date must be after check-in date');

      // Check availability
      const availability = await this.checkRoomTypeAvailability(room_type_id, hotelId, check_in_date, check_out_date, client);
      if (availability.remaining < quantity) {
        throw new Error('Selected room type is not available for selected dates');
      }

      // Calculate price
      const { formatDate } = require('../../../utils/dateUtils');
      const quoteService = require('../../rate/services/quote.service');
      const quote = await quoteService.getQuote({
        hotel_id: hotelId, room_type_id,
        check_in: formatDate(check_in_date), check_out: formatDate(check_out_date), quantity,
        adults: adults || 1, children: children || 0
      });

      const calculatedTotal = quote.final_total;
      const promoDiscount = quote.promo_discount || 0;
      const appliedPromo = quote.applied_promotion?.name || null;
      const ratePlan = quote.rate_plan || null;
      const rateRule = quote.rate_rule || null;
      const roomRate = quote.rate_per_night;
      const roomSubtotal = quote.room_subtotal;
      const occupancySurcharge = quote.occupancy_surcharge || 0;

      // Calculate addons
      let addonsTotal = 0;
      let validAddons = [];
      if (addons && Array.isArray(addons) && addons.length > 0) {
        const addonIds = addons.map(a => a.addon_id).filter(id => id);
        if (addonIds.length > 0) {
          const addonsRes = await client.query('SELECT id, price FROM addons WHERE id = ANY($1) AND hotel_id = $2', [addonIds, hotelId]);
          const dbAddons = new Map(addonsRes.rows.map(a => [a.id, a.price]));
          for (const addon of addons) {
            if (dbAddons.has(addon.addon_id)) {
              const price = parseFloat(dbAddons.get(addon.addon_id));
              const qty = parseInt(addon.quantity) || 1;
              addonsTotal += (price * qty);
              validAddons.push({ addon_id: addon.addon_id, quantity: qty, price_at_booking: price, total_price: price * qty });
            }
          }
        }
      }

      // Get user name
      const userRes = await client.query('SELECT full_name FROM users WHERE id = $1', [userId]);
      const userName = userRes.rows.length > 0 ? userRes.rows[0].full_name : 'Staff';

      // Generate FB- PNR
      const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      const bookingRef = `FB-${randomStr}`;

      // Insert booking directly as CHECKED_IN
      const insertQuery = `
        INSERT INTO bookings (
          booking_ref, hotel_id, guest_name, guest_email, guest_phone,
          check_in_date, check_out_date, adults, children, total_amount,
          status, created_by, room_type_id, quantity,
          promo_discount, applied_promotion, rate_plan_name, rate_rule_name,
          room_rate, room_subtotal, occupancy_surcharge
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CHECKED_IN', $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `;
      const result = await client.query(insertQuery, [
        bookingRef, hotelId, guest_name, guest_email, guest_phone,
        check_in_date, check_out_date, adults || 1, children || 0,
        calculatedTotal + addonsTotal, userId, room_type_id, quantity,
        promoDiscount, appliedPromo, ratePlan, rateRule, roomRate, roomSubtotal, occupancySurcharge
      ]);
      const booking = result.rows[0];

      // Insert addons
      for (const addon of validAddons) {
        await client.query(
          `INSERT INTO booking_addons (booking_id, addon_id, quantity, price_at_booking, total_price) VALUES ($1, $2, $3, $4, $5)`,
          [booking.id, addon.addon_id, addon.quantity, addon.price_at_booking, addon.total_price]
        );
      }

      // Assign rooms immediately
      for (const roomId of room_ids) {
        await client.query(`INSERT INTO booking_rooms (booking_id, room_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [booking.id, roomId]);
        await client.query('UPDATE rooms SET status = $1 WHERE id = $2', ['OCCUPIED', roomId]);
      }
      if (room_ids.length === 1) {
        await client.query('UPDATE bookings SET room_id = $1 WHERE id = $2', [room_ids[0], booking.id]);
      }

      // Store guest details
      for (const guest of guest_details) {
        if (guest.full_name) {
          await client.query(
            `INSERT INTO booking_guests (booking_id, full_name, age, id_proof_type, id_proof_number) VALUES ($1, $2, $3, $4, $5)`,
            [booking.id, guest.full_name, guest.age || null, guest.id_proof_type || null, guest.id_proof_number || null]
          );
        }
      }

      // Link any pending QR service requests for these rooms
      for (const roomId of room_ids) {
        await client.query(
          `UPDATE service_requests SET booking_id = $1, booking_ref = $2 WHERE room_id = $3 AND booking_id IS NULL AND status IN ('PENDING', 'IN_PROGRESS')`,
          [booking.id, bookingRef, roomId]
        );
      }

      // Status history + audit + timeline
      await this.createStatusHistory(booking.id, null, 'CHECKED_IN', userId, `Front desk walk-in by ${userName}`, client);
      await this.incrementBookingUsage(hotelId, client);
      await client.query(`UPDATE room_inventory SET booked_count = booked_count + $1 WHERE hotel_id = $2 AND room_type_id = $3 AND inventory_date >= $4::date AND inventory_date < $5::date`,
        [quantity, hotelId, room_type_id, check_in_date, check_out_date]);
      await this.createAuditLog({ hotel_id: hotelId, user_id: userId, action: 'CREATE_FRONT_BOOKING', entity_type: 'BOOKING', entity_id: booking.id, new_data: { ...booking, room_ids } }, client);
      await client.query(`INSERT INTO booking_events (booking_id, event_type, description) VALUES ($1, $2, $3)`,
        [booking.id, 'FRONT_BOOKING', `Walk-in guest checked in by ${userName}. Rooms: ${room_ids.length}`]);

      // Execute auto-task rules for BOOKING_CHECKIN (front booking = direct checkin)
      const frontRoomRes = await client.query('SELECT room_number FROM rooms WHERE id = ANY($1)', [room_ids]);
      const frontRoomNumbers = frontRoomRes.rows.map(r => r.room_number).join(', ');
      await taskService.executeAutoTasks(hotelId, 'BOOKING_CHECKIN', {
        booking_id: booking.id,
        guest_name: booking.guest_name || guest_name,
        booking_ref: bookingRef,
        room_number: frontRoomNumbers
      }, client);

      await client.query('COMMIT');
      return booking;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async checkRoomTypeAvailability(roomTypeId, hotelId, checkIn, checkOut, client = null) {
    const useClient = client || db;

    const inventoryQuery = `
      SELECT inventory_date, total_inventory, booked_count, (total_inventory - booked_count) as available
      FROM room_inventory
      WHERE hotel_id = $1 AND room_type_id = $2
      AND inventory_date >= $3::date AND inventory_date < $4::date
      FOR UPDATE
    `;
    const invRes = await useClient.query(inventoryQuery, [hotelId, roomTypeId, checkIn, checkOut]);

    const nights = Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)));

    if (invRes.rows.length < nights) {
      return { available: false, capacity: 0, booked: 0, remaining: 0 };
    }

    let minRemaining = Infinity;
    let maxCapacity = 0;
    let maxBooked = 0;

    for (const row of invRes.rows) {
      const avail = parseInt(row.available);
      if (avail < minRemaining) minRemaining = avail;
      if (parseInt(row.total_inventory) > maxCapacity) maxCapacity = parseInt(row.total_inventory);
      if (parseInt(row.booked_count) > maxBooked) maxBooked = parseInt(row.booked_count);
    }

    return {
      available: minRemaining > 0,
      capacity: maxCapacity,
      booked: maxBooked,
      remaining: minRemaining === Infinity ? 0 : minRemaining
    };
  }

  /**
   * Get bookings for hotel
   */
  async getBookingsByHotel(hotelId, filters = {}) {
    let query = `
      SELECT 
        b.*,
        json_agg(json_build_object('id', r.id, 'room_number', r.room_number)) FILTER (WHERE r.id IS NOT NULL) as rooms,
        rt_booked.name as room_type_name,
        u.full_name as created_by_name
      FROM bookings b
      LEFT JOIN room_types rt_booked ON rt_booked.id = b.room_type_id
      LEFT JOIN (
        SELECT booking_id, room_id FROM booking_rooms
        UNION
        SELECT id as booking_id, room_id FROM bookings WHERE room_id IS NOT NULL
      ) br ON br.booking_id = b.id
      LEFT JOIN rooms r ON r.id = br.room_id
      LEFT JOIN users u ON u.id = b.created_by
      WHERE b.hotel_id = $1 AND b.bulk_booking_id IS NULL
    `;

    const params = [hotelId];
    let paramCount = 1;

    if (filters.status) {
      paramCount++;
      query += ` AND b.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.from_date) {
      paramCount++;
      query += ` AND b.check_in_date >= $${paramCount}`;
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      paramCount++;
      query += ` AND b.check_out_date <= $${paramCount}`;
      params.push(filters.to_date);
    }

    if (filters.guest_phone || filters.search) {
      const searchTerm = filters.guest_phone || filters.search;
      paramCount++;
      query += ` AND (b.guest_phone LIKE $${paramCount} OR b.guest_name ILIKE $${paramCount} OR b.booking_ref ILIKE $${paramCount})`;
      params.push(`%${searchTerm}%`);
    }

    query += ' GROUP BY b.id, rt_booked.name, u.full_name';
    query += ' ORDER BY b.check_in_date DESC';

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(filters.limit));
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get all unique guests for a hotel with their latest booking info
   */
  async getGuestsByHotel(hotelId, filters = {}) {
    let query = `
      SELECT DISTINCT ON (bg.full_name, bg.id_proof_number)
        bg.id,
        bg.full_name,
        bg.age,
        bg.id_proof_type,
        bg.id_proof_number,
        b.check_in_date as last_visit,
        b.status as last_status,
        rt.name as last_room_type,
        b.total_amount
      FROM booking_guests bg
      JOIN bookings b ON b.id = bg.booking_id
      LEFT JOIN room_types rt ON rt.id = b.room_type_id
      WHERE b.hotel_id = $1
    `;

    const params = [hotelId];
    let paramCount = 1;

    if (filters.search) {
      paramCount++;
      query += ` AND (bg.full_name ILIKE $${paramCount} OR bg.id_proof_number LIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
    }

    // Order by name and then by check_in_date DESC to get the latest booking info for each unique guest
    // Distinct on requires matching order by
    query = `
      SELECT * FROM (
        ${query}
        ORDER BY bg.full_name, bg.id_proof_number, b.check_in_date DESC
      ) as subquery
      ORDER BY last_visit DESC
    `;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId, hotelId) {
    const query = `
      SELECT 
        b.*,
        json_agg(json_build_object('id', r.id, 'room_number', r.room_number, 'floor', r.floor)) FILTER (WHERE r.id IS NOT NULL) as rooms,
        (
          SELECT json_agg(json_build_object('addon_id', ba.addon_id, 'name', a.name, 'quantity', ba.quantity, 'price_at_booking', ba.price_at_booking, 'total_price', ba.total_price))
          FROM booking_addons ba
          JOIN addons a ON a.id = ba.addon_id
          WHERE ba.booking_id = b.id
        ) as addons,
        u.full_name as created_by_name,
        (
          SELECT json_agg(
            json_build_object(
              'from_status', bsh.from_status,
              'to_status', bsh.to_status,
              'changed_at', bsh.changed_at,
              'changed_by', u2.full_name,
              'reason', bsh.reason
            ) ORDER BY bsh.changed_at
          )
          FROM booking_status_history bsh
          LEFT JOIN users u2 ON u2.id = bsh.changed_by
          WHERE bsh.booking_id = b.id
        ) as status_history
      FROM bookings b
      LEFT JOIN (
        SELECT booking_id, room_id FROM booking_rooms
        UNION
        SELECT id as booking_id, room_id FROM bookings WHERE room_id IS NOT NULL
      ) br ON br.booking_id = b.id
      LEFT JOIN rooms r ON r.id = br.room_id
      LEFT JOIN users u ON u.id = b.created_by
      WHERE b.id = $1 AND b.hotel_id = $2
      GROUP BY b.id, u.full_name
    `;

    const result = await db.query(query, [bookingId, hotelId]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or access denied');
    }

    const booking = result.rows[0];

    // Fetch Timeline Events
    const eventsQuery = `SELECT event_type, description, created_at FROM booking_events WHERE booking_id = $1 ORDER BY created_at ASC`;
    const eventsRes = await db.query(eventsQuery, [booking.id]);
    booking.events = eventsRes.rows || [];

    return booking;
  }

  /**
   * Update booking status (with state machine validation)
   */
  async updateBookingStatus(bookingId, newStatus, userId, hotelId, reason = null, existingClient = null) {
    const client = existingClient || await db.pool.connect();

    try {
      if (!existingClient) await client.query('BEGIN');

      // Get current booking
      const bookingResult = await client.query(
        'SELECT * FROM bookings WHERE id = $1 AND hotel_id = $2',
        [bookingId, hotelId]
      );

      if (bookingResult.rows.length === 0) {
        throw new Error('Booking not found or access denied');
      }

      const booking = bookingResult.rows[0];
      const currentStatus = booking.status;

      // Validate state transition
      if (!this.VALID_TRANSITIONS[currentStatus]) {
        throw new Error(`Invalid current status: ${currentStatus}`);
      }

      if (!this.VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
        throw new Error(
          `Invalid transition from ${currentStatus} to ${newStatus}. ` +
          `Valid transitions: ${this.VALID_TRANSITIONS[currentStatus].join(', ')}`
        );
      }

      // Update booking status
      const updateResult = await client.query(
        `UPDATE bookings 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [newStatus, bookingId]
      );

      const updatedBooking = updateResult.rows[0];

      // Create status history
      await this.createStatusHistory(
        bookingId,
        currentStatus,
        newStatus,
        userId,
        reason,
        client
      );

      // Generate User Name
      const userRes = await client.query('SELECT full_name FROM users WHERE id = $1', [userId]);
      const userName = userRes.rows.length > 0 ? userRes.rows[0].full_name : 'Staff';

      // Log Timeline Event if Cancelled
      if (newStatus === 'CANCELLED') {
        await client.query(
          `INSERT INTO booking_events (booking_id, event_type, description) VALUES ($1, $2, $3)`,
          [bookingId, 'CANCELLED_BY_HOTEL', reason || `Booking cancelled by ${userName}`]
        );

        // Decrement Inventory back to available
        await client.query(`
          UPDATE room_inventory
          SET booked_count = GREATEST(0, booked_count - $1)
          WHERE hotel_id = $2
          AND room_type_id = $3
          AND inventory_date >= $4::date
          AND inventory_date < $5::date
        `, [booking.quantity || 1, hotelId, booking.room_type_id, booking.check_in_date, booking.check_out_date]);
      }

      // Update room status based on booking status
      const associatedRooms = await client.query(
        'SELECT room_id FROM booking_rooms WHERE booking_id = $1 UNION SELECT room_id FROM bookings WHERE id = $1 AND room_id IS NOT NULL',
        [bookingId]
      );
      const roomIds = associatedRooms.rows.map(r => r.room_id);

      if (newStatus === 'CHECKED_IN') {
        for (const rId of roomIds) {
          await client.query('UPDATE rooms SET status = $1 WHERE id = $2', ['OCCUPIED', rId]);
        }
      } else if (newStatus === 'CHECKED_OUT' || newStatus === 'CANCELLED') {
        for (const rId of roomIds) {
          await client.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', rId]);
        }
      }

      // Create audit log
      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'UPDATE_BOOKING_STATUS',
        entity_type: 'BOOKING',
        entity_id: bookingId,
        old_data: { status: currentStatus },
        new_data: { status: newStatus, reason }
      }, client);

      // NOTE: Auto-task hooks are NOT called here because updateBookingStatus is always
      // called by checkInBooking/checkOutWithBilling/createFrontBooking which already
      // call executeAutoTasks — calling here would cause duplicate tasks.

      // Auto-sync parent bulk booking status if this is a child booking
      if (booking.bulk_booking_id) {
        const siblingStatuses = await client.query(
          'SELECT status FROM bookings WHERE bulk_booking_id = $1',
          [booking.bulk_booking_id]
        );
        const statuses = siblingStatuses.rows.map(r => r.status);

        let derivedParentStatus = null;
        if (statuses.every(s => s === 'CANCELLED')) {
          derivedParentStatus = 'CANCELLED';
        } else if (statuses.every(s => s === 'CHECKED_OUT' || s === 'CANCELLED')) {
          derivedParentStatus = 'CHECKED_OUT';
        } else if (statuses.some(s => s === 'CHECKED_IN')) {
          derivedParentStatus = 'CHECKED_IN';
        } else if (statuses.some(s => s === 'CONFIRMED')) {
          derivedParentStatus = 'CONFIRMED';
        }

        if (derivedParentStatus) {
          await client.query(
            'UPDATE bulk_bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [derivedParentStatus, booking.bulk_booking_id]
          );
        }
      }

      if (!existingClient) await client.query('COMMIT');
      return updatedBooking;
    } catch (error) {
      if (!existingClient) await client.query('ROLLBACK');
      throw error;
    } finally {
      if (!existingClient) client.release();
    }
  }

  /**
   * Update booking payment
   */
  async updatePayment(bookingId, paidAmount, userId, hotelId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const oldDataResult = await client.query(
        'SELECT * FROM bookings WHERE id = $1 AND hotel_id = $2',
        [bookingId, hotelId]
      );

      if (oldDataResult.rows.length === 0) {
        throw new Error('Booking not found');
      }

      const oldData = oldDataResult.rows[0];

      const newPaidAmount = parseFloat(oldData.paid_amount) + parseFloat(paidAmount);

      if (newPaidAmount > parseFloat(oldData.total_amount)) {
        throw new Error('Paid amount exceeds total amount');
      }

      const result = await client.query(
        `UPDATE bookings 
         SET paid_amount = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [newPaidAmount, bookingId]
      );

      await this.createAuditLog({
        hotel_id: hotelId,
        user_id: userId,
        action: 'UPDATE_BOOKING_PAYMENT',
        entity_type: 'BOOKING',
        entity_id: bookingId,
        old_data: { paid_amount: oldData.paid_amount },
        new_data: { paid_amount: newPaidAmount, payment_added: paidAmount }
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
   * Cancel booking
   */
  async cancelBooking(bookingId, userId, hotelId, reason) {
    return this.updateBookingStatus(bookingId, 'CANCELLED', userId, hotelId, reason);
  }

  /**
   * Create status history record
   */
  async createStatusHistory(bookingId, fromStatus, toStatus, userId, reason, client) {
    const query = `
      INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by, reason)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await client.query(query, [bookingId, fromStatus, toStatus, userId, reason]);
  }

  // Old hardcoded createPreparationTask and createCleaningTask removed.
  // Auto-tasks are now fully handled by task_auto_rules via executeAutoTasks().

  /**
   * Helper: Increment booking usage counter
   */
  async incrementBookingUsage(hotelId, client) {
    const query = `
      INSERT INTO usage_counters (hotel_id, policy_limit_id, current_value)
      SELECT $1, pl.id, 1
      FROM policy_limits pl
      WHERE pl.key = 'booking_create'
      ON CONFLICT (hotel_id, policy_limit_id) 
      DO UPDATE SET 
        current_value = usage_counters.current_value + 1,
        updated_at = CURRENT_TIMESTAMP
    `;
    await client.query(query, [hotelId]);
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

  /**
   * Detailed Check-in with guest profiles and optional booking modifications
   */
  async checkInWithGuests(bookingId, hotelId, userId, guestDetails, roomIds, bookingUpdates = null) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch booking
      const bookingResult = await client.query(
        'SELECT * FROM bookings WHERE id = $1 AND hotel_id = $2',
        [bookingId, hotelId]
      );
      if (bookingResult.rows.length === 0) throw new Error('Booking not found');
      let booking = bookingResult.rows[0];

      if (bookingUpdates) {
        // Calculate new total amount
        const checkInDate = new Date(bookingUpdates.check_in_date || booking.check_in_date);
        const checkOutDate = new Date(bookingUpdates.check_out_date || booking.check_out_date);
        const nights = Math.max(1, Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
        const quantity = bookingUpdates.room_ids ? bookingUpdates.room_ids.length : (bookingUpdates.quantity || booking.quantity);
        const roomTypeId = bookingUpdates.room_type_id || booking.room_type_id;

        const rtRes = await client.query('SELECT base_price FROM room_types WHERE id = $1', [roomTypeId]);
        const basePrice = rtRes.rows[0].base_price;
        let totalAmount = basePrice * parseFloat(quantity) * nights;

        let totalAddonPrice = 0;
        if (bookingUpdates.addons && Array.isArray(bookingUpdates.addons)) {
          for (const addon of bookingUpdates.addons) {
            totalAddonPrice += parseFloat(addon.price || 0) * parseFloat(addon.quantity || 1);
          }
        }
        totalAmount += totalAddonPrice;

        // Update booking row
        await client.query(
          `UPDATE bookings 
           SET guest_name = COALESCE($1, guest_name), 
               guest_phone = COALESCE($2, guest_phone), 
               guest_email = COALESCE($3, guest_email),
               check_in_date = $4, check_out_date = $5, 
               adults = $6, children = $7, 
               room_type_id = $8, quantity = $9, 
               total_amount = $10
           WHERE id = $11 AND hotel_id = $12`,
          [
            bookingUpdates.guest_name, bookingUpdates.guest_phone, bookingUpdates.guest_email,
            checkInDate.toISOString().split('T')[0], checkOutDate.toISOString().split('T')[0],
            bookingUpdates.adults, bookingUpdates.children,
            roomTypeId, quantity, totalAmount,
            bookingId, hotelId
          ]
        );

        // Replace addons
        if (bookingUpdates.addons) {
          await client.query('DELETE FROM booking_addons WHERE booking_id = $1', [bookingId]);
          for (const addon of bookingUpdates.addons) {
            const addonTotalPrice = parseFloat(addon.price || 0) * parseFloat(addon.quantity || 1);
            await client.query(
              `INSERT INTO booking_addons (booking_id, addon_id, quantity, price_at_booking, total_price)
               VALUES ($1, $2, $3, $4, $5)`,
              [bookingId, addon.addon_id, addon.quantity || 1, addon.price || 0, addonTotalPrice]
            );
          }
        }

        // Refresh booking object for downstream logic
        const updatedRes = await client.query('SELECT * FROM bookings WHERE id = $1 AND hotel_id = $2', [bookingId, hotelId]);
        booking = updatedRes.rows[0];
      }


      await this.updateBookingStatus(bookingId, 'CHECKED_IN', userId, hotelId, 'Guest checked in with details and room assignment', client);

      // Save guest details
      for (const guest of guestDetails) {
        await client.query(
          `INSERT INTO booking_guests (booking_id, full_name, age, id_proof_type, id_proof_number)
           VALUES ($1, $2, $3, $4, $5)`,
          [bookingId, guest.full_name, guest.age || null, guest.id_proof_type, guest.id_proof_number]
        );
      }

      // Assign specific rooms
      if (roomIds && Array.isArray(roomIds)) {
        for (const roomId of roomIds) {
          await client.query(
            'INSERT INTO booking_rooms (booking_id, room_id) VALUES ($1, $2)',
            [bookingId, roomId]
          );
          await client.query(
            'UPDATE rooms SET status = $1 WHERE id = $2',
            ['OCCUPIED', roomId]
          );
        }
      }

      // Execute auto-task rules for BOOKING_CHECKIN
      const checkinRoomRes = await client.query('SELECT room_number FROM rooms WHERE id = ANY($1)', [roomIds]);
      const checkinRoomNumbers = checkinRoomRes.rows.map(r => r.room_number).join(', ');
      await taskService.executeAutoTasks(hotelId, 'BOOKING_CHECKIN', {
        booking_id: booking.id,
        guest_name: booking.guest_name,
        booking_ref: booking.booking_ref,
        room_number: checkinRoomNumbers
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
   * Detailed Check-out with billing calculation
   */
  async checkOutWithBilling(bookingId, hotelId, userId, extraCharges = [], couponCode = null) {
    // --- SR GUARD: Block checkout if pending service requests exist ---
    const qrcodeService = require('../../qrcode/services/qrcode.service');
    const pendingSRCount = await qrcodeService.getPendingSRCountForBooking(bookingId);
    if (pendingSRCount > 0) {
      throw new Error(`Cannot checkout: There ${pendingSRCount === 1 ? 'is' : 'are'} ${pendingSRCount} pending service request(s) for this room. Please complete or cancel them before checkout.`);
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get booking, room rates, and hotel info
      const query = `
        SELECT 
          b.*,
          h.name as hotel_name,
          h.gst_number as hotel_gst,
          json_agg(json_build_object('id', r.id, 'base_price', rt.base_price, 'room_number', r.room_number)) as room_rates
        FROM bookings b
        JOIN hotels h ON h.id = b.hotel_id
        LEFT JOIN (
          SELECT booking_id, room_id FROM booking_rooms
          UNION
          SELECT id as booking_id, room_id FROM bookings WHERE room_id IS NOT NULL
        ) br ON br.booking_id = b.id
        LEFT JOIN rooms r ON r.id = br.room_id
        LEFT JOIN room_types rt ON rt.id = r.room_type_id
        WHERE b.id = $1 AND b.hotel_id = $2
        GROUP BY b.id, h.name, h.gst_number
      `;
      const result = await client.query(query, [bookingId, hotelId]);
      if (result.rows.length === 0) throw new Error('Booking not found');

      const booking = result.rows[0];
      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

      // Generate dynamic quote mapping
      const { formatDate } = require('../../../utils/dateUtils');
      const quoteService = require('../../rate/services/quote.service');
      const quote = await quoteService.getQuote({
        hotel_id: hotelId,
        room_type_id: booking.room_type_id,
        check_in: formatDate(new Date(booking.check_in_date)),
        check_out: formatDate(new Date(booking.check_out_date)),
        quantity: booking.quantity || 1,
        coupon_code: couponCode || booking.applied_coupon || null
      });

      // LOCKED: Use stored room rate and subtotal from the booking record
      const totalRoomCharge = booking.room_subtotal ? parseFloat(booking.room_subtotal) : quote.room_subtotal;
      const promoDiscount = parseFloat(booking.promo_discount || 0);
      const couponDiscount = quote.coupon_discount;

      const ratePerNight = booking.room_rate ? parseFloat(booking.room_rate) : quote.rate_per_night;

      let extraTotal = 0;
      extraCharges.forEach(charge => {
        extraTotal += parseFloat(charge.amount || 0);
      });

      // Fetch Addons
      const addonsQuery = `
        SELECT ba.*, a.name 
        FROM booking_addons ba
        JOIN addons a ON a.id = ba.addon_id
        WHERE ba.booking_id = $1
      `;
      const addonsResult = await client.query(addonsQuery, [bookingId]);
      const rawAddons = addonsResult.rows || [];

      // Group similar addons
      const groupedAddons = {};
      rawAddons.forEach(item => {
        const key = item.addon_id;
        if (!groupedAddons[key]) {
          groupedAddons[key] = { ...item, quantity: 0, total_price: 0 };
        }
        groupedAddons[key].quantity += parseInt(item.quantity || 1);
        groupedAddons[key].total_price = (parseFloat(groupedAddons[key].total_price) + parseFloat(item.total_price || 0)).toFixed(2);
      });
      const addonsList = Object.values(groupedAddons);
      const addonTotal = addonsList.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);

      // Fetch Service Requests (Room Service)
      const srQuery = `
        SELECT sr.*, si.name as service_name, si.price as service_price, sc.name as category_name
        FROM service_requests sr
        JOIN service_items si ON si.id = sr.service_item_id
        LEFT JOIN service_categories sc ON sc.id = si.category_id
        WHERE sr.booking_id = $1 AND sr.status = 'COMPLETED'
      `;
      const srResult = await client.query(srQuery, [bookingId]);
      const rawServiceRequests = srResult.rows || [];

      // Group similar items
      const groupedSRs = {};
      rawServiceRequests.forEach(item => {
        const key = item.service_item_id;
        if (!groupedSRs[key]) {
          groupedSRs[key] = { ...item, quantity: 0 };
        }
        groupedSRs[key].quantity += parseInt(item.quantity || 1);
      });
      const serviceRequestsList = Object.values(groupedSRs);
      const serviceRequestsTotal = serviceRequestsList.reduce((sum, item) => sum + (item.quantity * parseFloat(item.service_price || 0)), 0);

      // --- TAX CALCULATION ENGINE ---
      const settingsService = require('../../settings/services/settings.service');
      const taxes = await settingsService.getTaxes(hotelId);
      const activeTaxes = taxes.filter(t => t.is_active);

      let roomSubtotal = totalRoomCharge - promoDiscount - couponDiscount;
      let extraSubtotal = extraTotal + addonTotal + serviceRequestsTotal;
      let finalTotal = roomSubtotal + extraSubtotal;
      const taxBreakdown = [];

      activeTaxes.filter(t => t.is_inclusive).forEach(tax => {
        const rate = parseFloat(tax.rate);
        let roomTaxAmt = 0;
        let extraTaxAmt = 0;

        if (tax.category === 'ROOM' || tax.category === 'ALL') {
          const base = roomSubtotal / (1 + rate / 100);
          roomTaxAmt = roomSubtotal - base;
        }

        // Calculate Extra Tax Base
        let taxBase = 0;
        if (tax.category === 'ALL' || tax.category === 'SERVICES' || tax.category === 'SERVICE') {
          taxBase += extraTotal + addonTotal;
        }
        serviceRequestsList.forEach(sr => {
          if (tax.category === 'ALL' || tax.category === 'SERVICES' || tax.category === 'SERVICE' || tax.category?.toUpperCase() === sr.category_name?.toUpperCase()) {
            taxBase += sr.quantity * parseFloat(sr.service_price || 0);
          }
        });

        if (taxBase > 0) {
          const base = taxBase / (1 + rate / 100);
          extraTaxAmt = taxBase - base;
        }

        if (roomTaxAmt > 0) {
          taxBreakdown.push({
            id: tax.id, name: tax.name, category: tax.category, rate, is_inclusive: true, amount: Number(roomTaxAmt.toFixed(2)), applied_to: 'ROOM'
          });
        }
        if (extraTaxAmt > 0) {
          const appliedTo = tax.category === 'ALL' ? 'SERVICE' : tax.category;
          taxBreakdown.push({
            id: tax.id, name: tax.name, category: tax.category, rate, is_inclusive: true, amount: Number(extraTaxAmt.toFixed(2)), applied_to: appliedTo
          });
        }
      });

      taxBreakdown.filter(t => t.is_inclusive).forEach(t => {
        if (t.applied_to === 'ROOM') roomSubtotal -= t.amount;
        else extraSubtotal -= t.amount;
      });

      activeTaxes.filter(t => !t.is_inclusive).forEach(tax => {
        const rate = parseFloat(tax.rate);
        let roomTaxAmt = 0;
        let extraTaxAmt = 0;

        if (tax.category === 'ROOM' || tax.category === 'ALL') {
          roomTaxAmt = roomSubtotal * (rate / 100);
        }

        let taxBase = 0;
        if (tax.category === 'ALL' || tax.category === 'SERVICES' || tax.category === 'SERVICE') {
          taxBase += extraTotal + addonTotal;
        }
        serviceRequestsList.forEach(sr => {
          if (tax.category === 'ALL' || tax.category === 'SERVICES' || tax.category === 'SERVICE' || tax.category?.toUpperCase() === sr.category_name?.toUpperCase()) {
            taxBase += sr.quantity * parseFloat(sr.service_price || 0);
          }
        });

        if (taxBase > 0) {
          extraTaxAmt = taxBase * (rate / 100);
        }

        if (roomTaxAmt > 0) {
          taxBreakdown.push({
            id: tax.id, name: tax.name, category: tax.category, rate, is_inclusive: false, amount: Number(roomTaxAmt.toFixed(2)), applied_to: 'ROOM'
          });
          finalTotal += roomTaxAmt;
        }
        if (extraTaxAmt > 0) {
          const appliedTo = tax.category === 'ALL' ? 'SERVICE' : tax.category;
          taxBreakdown.push({
            id: tax.id, name: tax.name, category: tax.category, rate, is_inclusive: false, amount: Number(extraTaxAmt.toFixed(2)), applied_to: appliedTo
          });
          finalTotal += extraTaxAmt;
        }
      });

      // Insert applied taxes into `booking_taxes` history table
      for (const tax of taxBreakdown) {
        await client.query(
          `INSERT INTO booking_taxes (booking_id, tax_id, name, rate, is_inclusive, amount)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [bookingId, tax.id, tax.name, tax.rate, tax.is_inclusive, tax.amount]
        );
      }

      // Update booking with total amount and historical pricing details
      await client.query(
        `UPDATE bookings SET 
          total_amount = $1, 
          status = $2, 
          updated_at = CURRENT_TIMESTAMP, 
          promo_discount = $4, 
          coupon_discount = $5, 
          applied_coupon = $6,
          applied_promotion = $7,
          rate_plan_name = $8,
          rate_rule_name = $9,
          service_charge = $10,
          invoice_number = $11,
          payment_status = $12
         WHERE id = $3`,
        [
          finalTotal,
          'CHECKED_OUT',
          bookingId,
          promoDiscount,
          couponDiscount,
          quote.applied_coupon?.code || null,
          booking.applied_promotion || quote.applied_promotion?.name || null,
          booking.rate_plan_name || quote.rate_plan || null,
          booking.rate_rule_name || quote.rate_rule || null,
          extraTotal,
          booking.invoice_number || await this.generateInvoiceNumber(hotelId, client),
          booking.payment_status || 'NOT_PAID'
        ]
      );

      // Re-fetch updated booking for the response
      const updatedBookingRes = await client.query('SELECT invoice_number, payment_status, payment_method FROM bookings WHERE id = $1', [bookingId]);
      const updatedBooking = updatedBookingRes.rows[0];

      // Update room status
      const associatedRooms = await client.query(
        'SELECT room_id FROM booking_rooms WHERE booking_id = $1 UNION SELECT room_id FROM bookings WHERE id = $1 AND room_id IS NOT NULL',
        [bookingId]
      );
      for (const row of associatedRooms.rows) {
        await client.query('UPDATE rooms SET status = $1 WHERE id = $2', ['AVAILABLE', row.room_id]);
      }

      // Record status history
      await this.createStatusHistory(bookingId, booking.status, 'CHECKED_OUT', userId, 'Guest checked out with billing', client);

      // Execute auto-task rules for BOOKING_CHECKOUT
      const checkoutRoomNums = associatedRooms.rows.length > 0
        ? (await client.query('SELECT room_number FROM rooms WHERE id = ANY($1)', [associatedRooms.rows.map(r => r.room_id)])).rows.map(r => r.room_number).join(', ')
        : '';
      await taskService.executeAutoTasks(hotelId, 'BOOKING_CHECKOUT', {
        booking_id: bookingId,
        guest_name: booking.guest_name,
        booking_ref: booking.booking_ref,
        room_number: checkoutRoomNums
      }, client);

      await client.query('COMMIT');
      return {
        success: true,
        billing: {
          nights,
          totalRoomCharge,
          extraTotal,
          addonTotal,
          addons: addonsList,
          serviceRequests: serviceRequestsList,
          extraCharges,
          serviceRequestsTotal: Number(serviceRequestsTotal.toFixed(2)),
          promoDiscount,
          couponDiscount,
          roomSubtotal: Number(roomSubtotal.toFixed(2)),
          extraSubtotal: Number(extraSubtotal.toFixed(2)),
          taxBreakdown,
          finalTotal: Number(finalTotal.toFixed(2)),
          hotel_name: booking.hotel_name,
          hotel_gst: booking.hotel_gst,
          guest_name: booking.guest_name,
          adults: booking.adults,
          children: booking.children,
          room_numbers: booking.room_rates?.map(r => r.room_number) || [],
          rate_plan: quote.rate_plan,
          rate_rule: quote.rate_rule,
          applied_promotion: quote.applied_promotion,
          applied_coupon: quote.applied_coupon,
          invoice_number: updatedBooking.invoice_number,
          payment_status: updatedBooking.payment_status,
          payment_method: updatedBooking.payment_method
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  /**
   * Get billing summary for a booking
   */
  async getBillingSummary(bookingId, hotelId, options = {}) {
    const { extraCharges = [], couponCode = null } = options;
    const query = `
      SELECT 
        b.*,
        h.name as hotel_name,
        h.gst_number as hotel_gst,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', r.id, 'base_price', rt.base_price, 'room_number', r.room_number))
            FROM booking_rooms br
            JOIN rooms r ON r.id = br.room_id
            JOIN room_types rt ON rt.id = r.room_type_id
            WHERE br.booking_id = b.id
          ),
          (
            SELECT json_agg(json_build_object('id', null, 'base_price', rt.base_price, 'room_number', 'TBD'))
            FROM room_types rt
            WHERE rt.id = b.room_type_id
          )
        ) as room_rates
      FROM bookings b
      JOIN hotels h ON h.id = b.hotel_id
      WHERE b.id = $1 AND b.hotel_id = $2
    `;
    const result = await db.query(query, [bookingId, hotelId]);
    if (result.rows.length === 0) throw new Error('Booking not found');

    const booking = result.rows[0];
    const checkIn = new Date(booking.check_in_date);
    const checkOut = new Date(booking.check_out_date);
    const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

    const { formatDate } = require('../../../utils/dateUtils');
    const quoteService = require('../../rate/services/quote.service');
    const quote = await quoteService.getQuote({
      hotel_id: hotelId,
      room_type_id: booking.room_type_id,
      check_in: formatDate(new Date(booking.check_in_date)),
      check_out: formatDate(new Date(booking.check_out_date)),
      quantity: booking.quantity || 1,
      coupon_code: couponCode || booking.applied_coupon || null
    });

    const isHistorical = booking.status === 'CHECKED_OUT' || booking.status === 'REFUNDED';

    // Fetch Hotel Settings for Payment Details - Wrapped in try-catch for extra safety
    let hotelSettings = {};
    try {
      const settingsRes = await db.query(
        'SELECT upi_id, bank_name, account_number, ifsc_code, upi_qr_code, currency_code, currency_symbol FROM hotel_settings WHERE hotel_id = $1',
        [hotelId]
      );
      hotelSettings = settingsRes.rows[0] || {};
    } catch (settingsError) {
      console.error('Failed to fetch hotel payment settings:', settingsError.message);
      // Fallback to empty settings to allow billing calculation to continue
    }

    // Room Rate & Subtotal: Prioritize stored values (Locked-in)
    const totalRoomCharge = booking.room_subtotal ? parseFloat(booking.room_subtotal) : quote.room_subtotal;
    const ratePerNight = booking.room_rate ? parseFloat(booking.room_rate) : quote.rate_per_night;

    // LOCKED: Promo discount is always from the booking record
    const promoDiscount = parseFloat(booking.promo_discount || 0);

    // LOCKED: Occupancy Surcharge is from the booking record, or quote for new/active preview
    const occupancySurcharge = booking.occupancy_surcharge !== undefined && booking.occupancy_surcharge !== null ? parseFloat(booking.occupancy_surcharge) : quote.occupancy_surcharge;
    const occupancyDetails = quote.occupancy_details;

    // DYNAMIC: Coupon discount can be recalculated if checking out (previewing)
    const couponDiscount = quote.coupon_discount;

    // Calculate extra charges total from options
    let extraTotal = 0;
    extraCharges.forEach(charge => {
      extraTotal += parseFloat(charge.amount || 0);
    });

    // If no manual charges provided, check for stored service_charge
    if (extraCharges.length === 0 && booking.service_charge) {
      extraTotal = parseFloat(booking.service_charge);
    }

    // Fetch Addons
    const addonsQuery = `
      SELECT ba.*, a.name 
      FROM booking_addons ba
      JOIN addons a ON a.id = ba.addon_id
      WHERE ba.booking_id = $1
    `;
    const addonsResult = await db.query(addonsQuery, [bookingId]);
    const rawAddons = addonsResult.rows || [];

    // Group similar addons
    const groupedAddons = {};
    rawAddons.forEach(item => {
      const key = item.addon_id;
      if (!groupedAddons[key]) {
        groupedAddons[key] = { ...item, quantity: 0, total_price: 0 };
      }
      groupedAddons[key].quantity += parseInt(item.quantity || 1);
      groupedAddons[key].total_price = (parseFloat(groupedAddons[key].total_price) + parseFloat(item.total_price || 0)).toFixed(2);
    });
    const addonsList = Object.values(groupedAddons);
    const addonTotal = addonsList.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);

    // Fetch Service Requests (Room Service)
    const srQuery = `
      SELECT sr.*, si.name as service_name, si.price as service_price, sc.name as category_name
      FROM service_requests sr
      JOIN service_items si ON si.id = sr.service_item_id
      LEFT JOIN service_categories sc ON sc.id = si.category_id
      WHERE sr.booking_id = $1 AND sr.status = 'COMPLETED'
    `;
    const srResult = await db.query(srQuery, [bookingId]);
    const rawServiceRequests = srResult.rows || [];

    // Group similar items
    const groupedSRs = {};
    rawServiceRequests.forEach(item => {
      const key = item.service_item_id;
      if (!groupedSRs[key]) {
        groupedSRs[key] = { ...item, quantity: 0 };
      }
      groupedSRs[key].quantity += parseInt(item.quantity || 1);
    });
    const serviceRequestsList = Object.values(groupedSRs);
    const serviceRequestsTotal = serviceRequestsList.reduce((sum, item) => sum + (item.quantity * parseFloat(item.service_price || 0)), 0);

    // --- TAX CALCULATION ENGINE ---
    const settingsService = require('../../settings/services/settings.service');
    const taxes = await settingsService.getTaxes(hotelId);
    const activeTaxes = taxes.filter(t => t.is_active);

    let roomSubtotal = totalRoomCharge + occupancySurcharge - promoDiscount - couponDiscount;
    let extraSubtotal = extraTotal + addonTotal + serviceRequestsTotal;
    let finalTotal = roomSubtotal + extraSubtotal;
    const taxBreakdown = [];

    activeTaxes.filter(t => t.is_inclusive).forEach(tax => {
      const rate = parseFloat(tax.rate);
      let roomTaxAmt = 0;
      let extraTaxAmt = 0;

      if (tax.category === 'ROOM' || tax.category === 'ALL') {
        const base = roomSubtotal / (1 + rate / 100);
        roomTaxAmt = roomSubtotal - base;
      }

      let taxBase = 0;
      if (tax.category === 'ALL' || tax.category === 'SERVICES' || tax.category === 'SERVICE') {
        taxBase += extraTotal + addonTotal;
      }
      serviceRequestsList.forEach(sr => {
        if (tax.category === 'ALL' || tax.category === 'SERVICES' || tax.category === 'SERVICE' || tax.category?.toUpperCase() === sr.category_name?.toUpperCase()) {
          taxBase += sr.quantity * parseFloat(sr.service_price || 0);
        }
      });

      if (taxBase > 0) {
        const base = taxBase / (1 + rate / 100);
        extraTaxAmt = taxBase - base;
      }

      if (roomTaxAmt > 0) {
        taxBreakdown.push({
          id: tax.id, name: tax.name, category: tax.category, rate, is_inclusive: true, amount: Number(roomTaxAmt.toFixed(2)), applied_to: 'ROOM'
        });
      }
      if (extraTaxAmt > 0) {
        const appliedTo = tax.category === 'ALL' ? 'SERVICE' : tax.category;
        taxBreakdown.push({
          id: tax.id, name: tax.name, category: tax.category, rate, is_inclusive: true, amount: Number(extraTaxAmt.toFixed(2)), applied_to: appliedTo
        });
      }
    });

    taxBreakdown.filter(t => t.is_inclusive).forEach(t => {
      if (t.applied_to === 'ROOM') roomSubtotal -= t.amount;
      else extraSubtotal -= t.amount;
    });

    activeTaxes.filter(t => !t.is_inclusive).forEach(tax => {
      const rate = parseFloat(tax.rate);
      let roomTaxAmt = 0;
      let extraTaxAmt = 0;

      if (tax.category === 'ROOM' || tax.category === 'ALL') {
        roomTaxAmt = roomSubtotal * (rate / 100);
      }

      let taxBase = 0;
      if (tax.category === 'ALL' || tax.category === 'SERVICES' || tax.category === 'SERVICE') {
        taxBase += extraTotal + addonTotal;
      }
      serviceRequestsList.forEach(sr => {
        if (tax.category === 'ALL' || tax.category === 'SERVICES' || tax.category === 'SERVICE' || tax.category?.toUpperCase() === sr.category_name?.toUpperCase()) {
          taxBase += sr.quantity * parseFloat(sr.service_price || 0);
        }
      });

      if (taxBase > 0) {
        extraTaxAmt = taxBase * (rate / 100);
      }

      if (roomTaxAmt > 0) {
        taxBreakdown.push({
          id: tax.id, name: tax.name, category: tax.category, rate, is_inclusive: false, amount: Number(roomTaxAmt.toFixed(2)), applied_to: 'ROOM'
        });
        finalTotal += roomTaxAmt;
      }
      if (extraTaxAmt > 0) {
        const appliedTo = tax.category === 'ALL' ? 'SERVICE' : tax.category;
        taxBreakdown.push({
          id: tax.id, name: tax.name, category: tax.category, rate, is_inclusive: false, amount: Number(extraTaxAmt.toFixed(2)), applied_to: appliedTo
        });
        finalTotal += extraTaxAmt;
      }
    });

    // Note: If booking is already checked out, we should technically pull taxes from `booking_taxes`
    // but for active/upcoming bookings we calculate live.
    if (isHistorical) {
      const savedTaxes = await db.query('SELECT * FROM booking_taxes WHERE booking_id = $1', [bookingId]);
      if (savedTaxes.rows.length > 0) {
        return {
          nights,
          totalRoomCharge,
          extraTotal,
          addonTotal,
          addons: addonsList,
          serviceRequests: serviceRequestsList,
          extraCharges: extraCharges.length > 0 ? extraCharges : (booking.service_charge ? [{ description: 'Extra Charges', amount: booking.service_charge }] : []),
          serviceRequestsTotal: Number(serviceRequestsTotal.toFixed(2)),
          occupancySurcharge: Number(occupancySurcharge.toFixed(2)),
          occupancyDetails,
          promoDiscount,
          couponDiscount,
          roomSubtotal: Number(roomSubtotal.toFixed(2)),
          extraSubtotal: Number(extraSubtotal.toFixed(2)),
          taxBreakdown: savedTaxes.rows, // Overwrite with exact historical taxes
          finalTotal: Number(finalTotal.toFixed(2)),
          status: booking.status,
          hotel_name: booking.hotel_name,
          hotel_gst: booking.hotel_gst,
          guest_name: booking.guest_name,
          adults: booking.adults,
          children: booking.children,
          room_numbers: booking.room_rates?.map(r => r.room_number) || [],
          rate_plan: booking.rate_plan_name || quote.rate_plan,
          rate_rule: booking.rate_rule_name || quote.rate_rule,
          applied_promotion: booking.applied_promotion ? { name: booking.applied_promotion, discount_amount: promoDiscount } : quote.applied_promotion,
          applied_coupon: booking.applied_coupon ? { code: booking.applied_coupon, discount_amount: couponDiscount } : null,
          invoice_number: booking.invoice_number,
          payment_status: booking.payment_status,
          payment_method: booking.payment_method,
          hotel_settings: hotelSettings
        };
      }
    }

    return {
      nights,
      rate_per_night: ratePerNight,
      totalRoomCharge: Number(totalRoomCharge.toFixed(2)),
      extraTotal: Number(extraTotal.toFixed(2)),
      addonTotal: Number(addonTotal.toFixed(2)),
      addons: addonsList,
      serviceRequests: serviceRequestsList,
      extraCharges: extraCharges.length > 0 ? extraCharges : (booking.service_charge ? [{ description: 'Extra Charges', amount: booking.service_charge }] : []),
      serviceRequestsTotal: Number(serviceRequestsTotal.toFixed(2)),
      occupancySurcharge: Number(occupancySurcharge.toFixed(2)),
      occupancyDetails,
      promoDiscount: Number(promoDiscount.toFixed(2)),
      couponDiscount: Number(couponDiscount.toFixed(2)),
      roomSubtotal: Number(roomSubtotal.toFixed(2)),
      extraSubtotal: Number(extraSubtotal.toFixed(2)),
      taxBreakdown,
      finalTotal: Number(finalTotal.toFixed(2)),
      status: booking.status,
      hotel_name: booking.hotel_name,
      hotel_gst: booking.hotel_gst,
      guest_name: booking.guest_name,
      adults: booking.adults,
      children: booking.children,
      room_numbers: booking.room_rates?.map(r => r.room_number) || [],
      rate_plan: booking.rate_plan_name || quote.rate_plan,
      rate_rule: booking.rate_rule_name || quote.rate_rule,
      applied_promotion: booking.applied_promotion || (quote.applied_promotion ? quote.applied_promotion.name : null),
      applied_coupon: quote.applied_coupon,
      invoice_number: booking.invoice_number,
      payment_status: booking.payment_status,
      payment_method: booking.payment_method,
      hotel_settings: hotelSettings
    };
  }

  /**
   * Settle payment for a booking
   */
  async settlePayment(bookingId, hotelId, paymentMethod, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get current booking to check invoice_number
      const bookingRes = await client.query(
        'SELECT invoice_number, status FROM bookings WHERE id = $1 AND hotel_id = $2',
        [bookingId, hotelId]
      );
      if (bookingRes.rows.length === 0) throw new Error('Booking not found');
      const booking = bookingRes.rows[0];

      // 2. Generate invoice number if not already present
      let invoiceNumber = booking.invoice_number;
      if (!invoiceNumber) {
        invoiceNumber = await this.generateInvoiceNumber(hotelId, client);
      }

      // 3. Update booking status
      const updateQuery = `
        UPDATE bookings 
        SET payment_status = 'PAID', 
            payment_method = $1,
            invoice_number = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND hotel_id = $4
        RETURNING *
      `;
      const result = await client.query(updateQuery, [paymentMethod, invoiceNumber, bookingId, hotelId]);

      if (result.rowCount === 0) {
        throw new Error('Failed to update booking settlement. Booking not found or unauthorized.');
      }

      // 4. Mark all COMPLETED service requests for this booking as BILLED
      await client.query(
        "UPDATE service_requests SET is_billed = true WHERE booking_id = $1 AND status = 'COMPLETED'",
        [bookingId]
      );

      // 5. Record in history
      await this.createStatusHistory(bookingId, booking.status, booking.status, userId, `Payment settled via ${paymentMethod}. Invoice: ${invoiceNumber}`, client);

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
   * Get all bookings for export (no pagination)
   */
  async getAllBookingsForExport(hotelId) {
    const query = `
      SELECT 
        b.id,
        b.check_in_date,
        b.check_out_date,
        b.total_amount,
        b.status,
        b.created_at,
        b.adults,
        b.children,
        b.quantity,
        rt.name as room_type_name,
        string_agg(r.room_number::text, ', ') as room_numbers
      FROM bookings b
      LEFT JOIN room_types rt ON rt.id = b.room_type_id
      LEFT JOIN (
        SELECT booking_id, room_id FROM booking_rooms
        UNION
        SELECT id as booking_id, room_id FROM bookings WHERE room_id IS NOT NULL
      ) br ON br.booking_id = b.id
      LEFT JOIN rooms r ON r.id = br.room_id
      WHERE b.hotel_id = $1
      GROUP BY b.id, rt.name
      ORDER BY b.check_in_date DESC
    `;

    const result = await db.query(query, [hotelId]);
    return result.rows;
  }
}

module.exports = new BookingService();
