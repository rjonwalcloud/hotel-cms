const roomTypeService = require('../services/room-type.service');

class RoomTypeController {
    async createRoomType(req, res, next) {
        try {
            const hotelId = req.body.hotel_id || req.user.hotel_id;
            if (!hotelId) {
                return res.status(400).json({ error: 'Hotel ID is required' });
            }
            const roomType = await roomTypeService.createRoomType(req.body, req.user.id, hotelId);
            res.status(201).json({ success: true, roomType });
        } catch (error) {
            next(error);
        }
    }

    async getRoomTypes(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const roomTypes = await roomTypeService.getRoomTypesByHotel(hotelId);
            res.json({ success: true, roomTypes });
        } catch (error) {
            next(error);
        }
    }

    async syncInventory(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const days = req.body.days || 365;
            await roomTypeService.syncInventory(hotelId, days);
            res.json({ success: true, message: `Inventory synced successfully for ${days} days.` });
        } catch (error) {
            next(error);
        }
    }

    async updateRoomType(req, res, next) {
        try {
            const { id } = req.params;
            const hotelId = req.body.hotel_id || req.user.hotel_id;
            const roomType = await roomTypeService.updateRoomType(id, req.body, req.user.id, hotelId);
            res.json({ success: true, roomType });
        } catch (error) {
            next(error);
        }
    }

    async deleteRoomType(req, res, next) {
        try {
            const { id } = req.params;
            const hotelId = req.query.hotel_id || req.user.hotel_id;
            await roomTypeService.deleteRoomType(id, hotelId);
            res.json({ success: true, message: 'Room type deleted successfully' });
        } catch (error) {
            if (error.message.includes('being used')) {
                return res.status(409).json({ error: 'Conflict', message: error.message });
            }
            next(error);
        }
    }
}

module.exports = new RoomTypeController();
