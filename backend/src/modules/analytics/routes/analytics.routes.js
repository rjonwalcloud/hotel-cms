const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requireAnyRole } = require('../../../middleware/rbac.middleware');

// Allow HOTEL_ADMIN and SUPER_ADMIN
router.get('/:hotelId/summary', authMiddleware, requireAnyRole(['HOTEL_ADMIN', 'SUPER_ADMIN']), analyticsController.getSummary);
router.get('/:hotelId/charts', authMiddleware, requireAnyRole(['HOTEL_ADMIN', 'SUPER_ADMIN']), analyticsController.getChartData);

module.exports = router;
