const express = require('express');
const router = express.Router();
const rateController = require('../controllers/rate.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');

// Rate Plans
router.get('/plans/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_VIEW'), rateController.getRatePlans);
router.post('/plans/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), rateController.createRatePlan);
router.put('/plans/:id/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), rateController.updateRatePlan);
router.delete('/plans/:id/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), rateController.deleteRatePlan);

// Rate Rules
router.get('/rules/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_VIEW'), rateController.getRateRules);
router.post('/rules/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), rateController.createRateRule);
router.put('/rules/:id/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), rateController.updateRateRule);
router.delete('/rules/:id/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), rateController.deleteRateRule);

module.exports = router;
