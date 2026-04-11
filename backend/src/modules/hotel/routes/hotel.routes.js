const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotel.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');

// Create hotel (Super Admin only)
router.post(
  '/',
  authMiddleware,
  requirePermission('HOTEL_CREATE'),
  hotelController.createHotel
);

// Get all hotels
router.get(
  '/',
  authMiddleware,
  requirePermission('HOTEL_VIEW'),
  hotelController.getAllHotels
);

// Get hotel by ID
router.get(
  '/:hotel_id',
  authMiddleware,
  requirePermission('HOTEL_VIEW'),
  hotelController.getHotelById
);

// Update hotel
router.put(
  '/:hotel_id',
  authMiddleware,
  requirePermission('HOTEL_UPDATE'),
  hotelController.updateHotel
);

// Toggle hotel status
router.patch(
  '/:hotel_id/status',
  authMiddleware,
  requirePermission('HOTEL_UPDATE'),
  hotelController.toggleHotelStatus
);

// Get hotel statistics
router.get(
  '/:hotel_id/stats',
  authMiddleware,
  requirePermission('HOTEL_VIEW'),
  hotelController.getHotelStats
);

module.exports = router;
