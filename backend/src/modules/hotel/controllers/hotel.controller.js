const hotelService = require('../services/hotel.service');

class HotelController {
  /**
   * POST /api/hotels
   * Create a new hotel (Super Admin only)
   */
  async createHotel(req, res, next) {
    try {
      const hotel = await hotelService.createHotel(req.body, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Hotel created successfully',
        hotel
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/hotels
   * Get all hotels
   */
  async getAllHotels(req, res, next) {
    try {
      const filters = {
        is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
        city: req.query.city,
        country: req.query.country
      };

      const hotels = await hotelService.getAllHotels(filters);

      res.json({
        success: true,
        count: hotels.length,
        hotels
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/hotels/:hotel_id
   * Get hotel by ID
   */
  async getHotelById(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const hotel = await hotelService.getHotelById(hotel_id);

      res.json({
        success: true,
        hotel
      });
    } catch (error) {
      if (error.message === 'Hotel not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * PUT /api/hotels/:hotel_id
   * Update hotel
   */
  async updateHotel(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const hotel = await hotelService.updateHotel(hotel_id, req.body, req.user.id);

      res.json({
        success: true,
        message: 'Hotel updated successfully',
        hotel
      });
    } catch (error) {
      if (error.message === 'Hotel not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * PATCH /api/hotels/:hotel_id/status
   * Activate/Deactivate hotel
   */
  async toggleHotelStatus(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const { is_active } = req.body;

      if (is_active === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'is_active field is required'
        });
      }

      const hotel = await hotelService.toggleHotelStatus(hotel_id, is_active, req.user.id);

      res.json({
        success: true,
        message: `Hotel ${is_active ? 'activated' : 'deactivated'} successfully`,
        hotel
      });
    } catch (error) {
      if (error.message === 'Hotel not found') {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/hotels/:hotel_id/stats
   * Get hotel statistics
   */
  async getHotelStats(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const stats = await hotelService.getHotelStats(hotel_id);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new HotelController();
