const express = require('express');
const router = express.Router();
const amenityController = require('../controllers/amenity.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');

router.post('/', authMiddleware, requirePermission('HOTEL_UPDATE'), amenityController.create);
router.get('/hotel', authMiddleware, requirePermission('HOTEL_VIEW'), amenityController.getByHotel);
router.put('/:id', authMiddleware, requirePermission('HOTEL_UPDATE'), amenityController.update);
router.delete('/:id', authMiddleware, requirePermission('HOTEL_UPDATE'), amenityController.delete);

module.exports = router;
