const roomService = require('../services/room.service');

class RoomController {
  /**
   * POST /api/rooms
   * Create a new room
   */
  async createRoom(req, res, next) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;
      
      if (!hotelId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Hotel ID is required'
        });
      }

      const room = await roomService.createRoom(req.body, req.user.id, hotelId);

      res.status(201).json({
        success: true,
        message: 'Room created successfully',
        room,
        quota: req.quota // Include quota info from middleware
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/rooms/hotel/:hotel_id
   * Get all rooms for a hotel
   */
  async getRoomsByHotel(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const filters = {
        status: req.query.status,
        room_type_id: req.query.room_type_id,
        floor: req.query.floor ? parseInt(req.query.floor) : undefined
      };

      const rooms = await roomService.getRoomsByHotel(hotel_id, filters);

      res.json({
        success: true,
        count: rooms.length,
        rooms
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rooms/:room_id
   * Get single room
   */
  async getRoomById(req, res, next) {
    try {
      const { room_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;

      const room = await roomService.getRoomById(room_id, hotelId);

      res.json({
        success: true,
        room
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
   * PATCH /api/rooms/:room_id/status
   * Update room status
   */
  async updateRoomStatus(req, res, next) {
    try {
      const { room_id } = req.params;
      const { status } = req.body;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      if (!status) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Status is required'
        });
      }

      const room = await roomService.updateRoomStatus(
        room_id,
        status,
        req.user.id,
        hotelId
      );

      res.json({
        success: true,
        message: 'Room status updated successfully',
        room
      });
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      if (error.message.includes('Invalid status')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * PUT /api/rooms/:room_id
   * Update room details
   */
  async updateRoom(req, res, next) {
    try {
      const { room_id } = req.params;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      const room = await roomService.updateRoom(
        room_id,
        req.body,
        req.user.id,
        hotelId
      );

      res.json({
        success: true,
        message: 'Room updated successfully',
        room
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/rooms/:room_id
   * Delete room
   */
  async deleteRoom(req, res, next) {
    try {
      const { room_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;

      await roomService.deleteRoom(room_id, req.user.id, hotelId);

      res.json({
        success: true,
        message: 'Room deleted successfully'
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      if (error.message.includes('existing bookings')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }
      next(error);
    }
  }
}

module.exports = new RoomController();
