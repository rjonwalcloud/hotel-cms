const inventoryService = require('../services/inventory.service');

class InventoryController {
    async getDashboardStats(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            if (!hotelId) {
                return res.status(400).json({ error: 'Hotel ID is required' });
            }

            const stats = await inventoryService.getDashboardStats(hotelId);
            res.json({ success: true, stats });
        } catch (error) {
            next(error);
        }
    }

    async getInventoryCalendar(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;

            const today = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(today.getDate() + 30);

            const startDate = req.query.start_date || today.toISOString().split('T')[0];
            const endDate = req.query.end_date || thirtyDaysFromNow.toISOString().split('T')[0];

            if (!hotelId) {
                return res.status(400).json({ error: 'Hotel ID is required' });
            }

            const calendar = await inventoryService.getInventoryCalendar(hotelId, startDate, endDate);
            res.json({ success: true, startDate, endDate, ...calendar });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new InventoryController();
