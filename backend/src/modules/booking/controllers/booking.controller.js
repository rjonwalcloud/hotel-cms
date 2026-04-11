const bookingService = require('../services/booking.service');
const { formatDate } = require('../../../utils/dateUtils');

class BookingController {
  /**
   * POST /api/bookings
   * Create a new booking
   */
  async createBooking(req, res, next) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      if (!hotelId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Hotel ID is required'
        });
      }

      const booking = await bookingService.createBooking(req.body, req.user.id, hotelId);

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        booking,
        quota: req.quota
      });
    } catch (error) {
      if (error.message.includes('not available')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }
      if (error.message.includes('Check-out date')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/bookings/front-booking
   * Create a front desk walk-in booking (directly CHECKED_IN)
   */
  async createFrontBooking(req, res, next) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;
      if (!hotelId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Hotel ID is required' });
      }
      const booking = await bookingService.createFrontBooking(req.body, req.user.id, hotelId);
      res.status(201).json({ success: true, message: 'Front booking created and checked in', booking, quota: req.quota });
    } catch (error) {
      if (error.message.includes('not available') || error.message.includes('must be selected')) {
        return res.status(409).json({ error: 'Conflict', message: error.message });
      }
      next(error);
    }
  }

  /**
   * GET /api/bookings/hotel/:hotel_id
   * Get all bookings for a hotel
   */
  async getBookingsByHotel(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const filters = {
        status: req.query.status,
        from_date: req.query.from_date,
        to_date: req.query.to_date,
        guest_phone: req.query.guest_phone,
        search: req.query.search
      };

      const bookings = await bookingService.getBookingsByHotel(hotel_id, filters);

      res.json({
        success: true,
        count: bookings.length,
        bookings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/bookings/guests/hotel/:hotel_id
   * Get all guests for a hotel
   */
  async getGuestsByHotel(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const filters = {
        search: req.query.search
      };

      const guests = await bookingService.getGuestsByHotel(hotel_id, filters);

      res.json({
        success: true,
        count: guests.length,
        guests
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/bookings/:booking_id
   * Get booking by ID
   */
  async getBookingById(req, res, next) {
    try {
      const { booking_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;

      const booking = await bookingService.getBookingById(booking_id, hotelId);

      res.json({
        success: true,
        booking
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * PATCH /api/bookings/:booking_id/status
   * Update booking status
   */
  async updateBookingStatus(req, res, next) {
    try {
      const { booking_id } = req.params;
      const { status, reason } = req.body;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      if (!status) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Status is required'
        });
      }

      const booking = await bookingService.updateBookingStatus(
        booking_id,
        status,
        req.user.id,
        hotelId,
        reason
      );

      res.json({
        success: true,
        message: 'Booking status updated successfully',
        booking
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      if (error.message.includes('Invalid transition') || error.message.includes('Invalid current status')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/bookings/:booking_id/payment
   * Add payment to booking
   */
  async addPayment(req, res, next) {
    try {
      const { booking_id } = req.params;
      const { amount } = req.body;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Valid payment amount is required'
        });
      }

      const booking = await bookingService.updatePayment(
        booking_id,
        amount,
        req.user.id,
        hotelId
      );

      res.json({
        success: true,
        message: 'Payment added successfully',
        booking
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      if (error.message.includes('exceeds total')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/bookings/:booking_id/cancel
   * Cancel booking
   */
  async cancelBooking(req, res, next) {
    try {
      const { booking_id } = req.params;
      const { reason } = req.body;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      const booking = await bookingService.cancelBooking(
        booking_id,
        req.user.id,
        hotelId,
        reason || 'Cancelled by user'
      );

      res.json({
        success: true,
        message: 'Booking cancelled successfully',
        booking
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      if (error.message.includes('Invalid transition')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/bookings/:booking_id/checkin
   * Check-in guest with details
   */
  async checkIn(req, res, next) {
    try {
      const { booking_id } = req.params;
      const { guest_details, room_ids, booking_updates } = req.body;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      if (!guest_details || !Array.isArray(guest_details)) {
        return res.status(400).json({ error: 'Guest details are required' });
      }

      const result = await bookingService.checkInWithGuests(
        booking_id,
        hotelId,
        req.user.id,
        guest_details,
        room_ids,
        booking_updates
      );

      res.json({
        success: true,
        message: 'Guest checked in successfully'
      });
    } catch (error) {
      if (error.message.includes('Invalid transition')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Booking cannot be checked in at this stage'
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/bookings/:booking_id/settle-payment
   * Settle payment for a booking
   */
  async settlePayment(req, res, next) {
    try {
      const { booking_id } = req.params;
      const { payment_method } = req.body;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      if (!payment_method) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Payment method is required'
        });
      }

      const booking = await bookingService.settlePayment(
        booking_id,
        hotelId,
        payment_method,
        req.user.id
      );

      res.json({
        success: true,
        message: 'Payment settled successfully',
        booking
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/bookings/:booking_id/checkout
   * Check-out guest with billing
   */
  async checkOut(req, res, next) {
    try {
      const { booking_id } = req.params;
      const { extra_charges, coupon_code } = req.body;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      const result = await bookingService.checkOutWithBilling(
        booking_id,
        hotelId,
        req.user.id,
        extra_charges || [],
        coupon_code || null
      );

      res.json({
        success: true,
        message: 'Guest checked out successfully',
        billing: result.billing
      });
    } catch (error) {
      if (error.message.includes('Invalid transition')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Guest must be checked in before check-out'
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/bookings/check-availability
   * Check room availability
   */
  async checkAvailability(req, res, next) {
    try {
      const { room_id, check_in_date, check_out_date } = req.query;

      if (!room_id || !check_in_date || !check_out_date) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'room_id, check_in_date, and check_out_date are required'
        });
      }

      const availability = await bookingService.checkRoomAvailability(
        room_id,
        check_in_date,
        check_out_date
      );

      res.json({
        success: true,
        ...availability
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/bookings/:booking_id/billing
   * Get billing summary for a booking
   */
  async getBillingSummary(req, res, next) {
    try {
      const { booking_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;

      const { charges, coupon_code } = req.query;

      // Parse charges if they come as a string (common with query params)
      let parsedCharges = [];
      if (charges) {
        try {
          parsedCharges = typeof charges === 'string' ? JSON.parse(charges) : charges;
        } catch (e) {
          console.error('Failed to parse charges in getBillingSummary:', e);
        }
      }

      const summary = await bookingService.getBillingSummary(booking_id, hotelId, {
        extraCharges: parsedCharges,
        couponCode: coupon_code
      });

      res.json({
        success: true,
        billing: summary
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/bookings/hotel/:hotel_id/export
   * Export bookings to CSV
   */
  async exportBookings(req, res, next) {
    try {
      const { hotel_id } = req.params;
      console.log(`[Export] Request received for hotel: ${hotel_id}`);
      const bookings = await bookingService.getAllBookingsForExport(hotel_id);
      console.log(`[Export] Found ${bookings.length} bookings`);

      // Convert to CSV
      const csvHeader = 'Booking ID,Room Type,Rooms,Check In,Check Out,Adults,Children,Quantity,Total Amount,Status,Created At\n';
      const csvRows = bookings.map(b => {
        // Format dates
        const checkIn = formatDate(new Date(b.check_in_date));
        const checkOut = formatDate(new Date(b.check_out_date));
        const createdAt = formatDate(new Date(b.created_at));

        // Escape content that might contain commas
        const rooms = b.room_numbers ? `"${b.room_numbers}"` : '';
        const roomType = b.room_type_name ? `"${b.room_type_name}"` : '';

        return `${b.id.substring(0, 8)}...,${roomType},${rooms},${checkIn},${checkOut},${b.adults},${b.children},${b.quantity},${b.total_amount},${b.status},${createdAt}`;
      }).join('\n');

      const csv = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=bookings-${hotel_id}-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BookingController();
