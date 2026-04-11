const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { requireActiveSubscription } = require('../../../middleware/subscription.middleware');

// GET /api/inventory/hotel/:hotel_id/dashboard
router.get(
    '/hotel/:hotel_id/dashboard',
    authMiddleware,
    requirePermission('ROOM_VIEW'),
    requireActiveSubscription,
    inventoryController.getDashboardStats
);

// GET /api/inventory/hotel/:hotel_id/calendar
router.get(
    '/hotel/:hotel_id/calendar',
    authMiddleware,
    requirePermission('ROOM_VIEW'),
    requireActiveSubscription,
    inventoryController.getInventoryCalendar
);

module.exports = router;
