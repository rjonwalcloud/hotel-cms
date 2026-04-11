const express = require('express');
const router = express.Router();
const addonController = require('../controllers/addon.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');

router.post('/', authMiddleware, requirePermission('HOTEL_UPDATE'), addonController.createAddon);
router.get('/hotel/:hotel_id', authMiddleware, addonController.getAddons);
router.put('/:id', authMiddleware, requirePermission('HOTEL_UPDATE'), addonController.updateAddon);
router.delete('/:id', authMiddleware, requirePermission('HOTEL_UPDATE'), addonController.deleteAddon);

module.exports = router;
