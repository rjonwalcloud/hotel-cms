const bookingManagerService = require('../services/booking-manager.service');

class BookingManagerController {
  // ============================================
  // CHANNEL ENDPOINTS
  // ============================================

  async createChannel(req, res, next) {
    try {
      const channel = await bookingManagerService.createChannel(req.body, req.user.id);
      res.status(201).json({ success: true, message: 'Channel created', channel });
    } catch (error) {
      if (error.message === 'Channel type already exists for this hotel') {
        return res.status(409).json({ error: 'Conflict', message: error.message });
      }
      next(error);
    }
  }

  async getChannelsByHotel(req, res, next) {
    try {
      const channels = await bookingManagerService.getChannelsByHotel(req.params.hotel_id);
      res.json({ success: true, count: channels.length, channels });
    } catch (error) {
      next(error);
    }
  }

  async getChannelById(req, res, next) {
    try {
      const channel = await bookingManagerService.getChannelById(
        req.params.channel_id, req.query.hotel_id
      );
      res.json({ success: true, channel });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  async updateChannel(req, res, next) {
    try {
      const { hotel_id, ...updateData } = req.body;
      const channel = await bookingManagerService.updateChannel(
        req.params.channel_id, hotel_id, updateData, req.user.id
      );
      res.json({ success: true, message: 'Channel updated', channel });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  async toggleChannelStatus(req, res, next) {
    try {
      const { is_active, hotel_id } = req.body;
      const channel = await bookingManagerService.toggleChannelStatus(
        req.params.channel_id, hotel_id, is_active, req.user.id
      );
      res.json({ success: true, message: 'Channel status updated', channel });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  async deleteChannel(req, res, next) {
    try {
      const result = await bookingManagerService.deleteChannel(
        req.params.channel_id, req.query.hotel_id, req.user.id
      );
      res.json({ success: true, ...result });
    } catch (error) {
      if (error.message === 'Channel not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      if (error.message === 'Cannot delete channel with active bookings') {
        return res.status(409).json({ error: 'Conflict', message: error.message });
      }
      next(error);
    }
  }

  // ============================================
  // CHANNEL BOOKING ENDPOINTS
  // ============================================

  async createChannelBooking(req, res, next) {
    try {
      const booking = await bookingManagerService.createChannelBooking(req.body, req.user.id);
      res.status(201).json({ success: true, message: 'Channel booking created', booking });
    } catch (error) {
      next(error);
    }
  }

  async getChannelBookings(req, res, next) {
    try {
      const filters = {
        channel_id: req.query.channel_id,
        status: req.query.status,
        channel_type: req.query.channel_type,
        from_date: req.query.from_date,
        to_date: req.query.to_date,
        limit: req.query.limit
      };
      const bookings = await bookingManagerService.getChannelBookings(
        req.params.hotel_id, filters
      );
      res.json({ success: true, count: bookings.length, bookings });
    } catch (error) {
      next(error);
    }
  }

  async updateChannelBookingStatus(req, res, next) {
    try {
      const { status, hotel_id } = req.body;
      const booking = await bookingManagerService.updateChannelBookingStatus(
        req.params.booking_id, hotel_id, status, req.user.id
      );
      res.json({ success: true, message: 'Booking status updated', booking });
    } catch (error) {
      if (error.message === 'Channel booking not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  async getChannelStats(req, res, next) {
    try {
      const stats = await bookingManagerService.getChannelStats(req.params.hotel_id);
      res.json({ success: true, stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BookingManagerController();
