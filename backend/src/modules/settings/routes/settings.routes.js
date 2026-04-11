const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission, requireAnyPermission } = require('../../../middleware/rbac.middleware');

// Protect all settings routes
router.use(authMiddleware);

// Settings
router.get('/', requirePermission('HOTEL_VIEW'), settingsController.getSettings);
router.put('/', requirePermission('HOTEL_UPDATE'), settingsController.updateSettings);

// Taxes
router.get('/taxes', requireAnyPermission(['HOTEL_VIEW', 'BOOKING_VIEW', 'SERVICE_REQUEST_VIEW']), settingsController.getTaxes);
router.post('/taxes', requirePermission('HOTEL_UPDATE'), settingsController.createTax);
router.put('/taxes/:id', requirePermission('HOTEL_UPDATE'), settingsController.updateTax);
router.delete('/taxes/:id', requirePermission('HOTEL_UPDATE'), settingsController.deleteTax);

module.exports = router;
