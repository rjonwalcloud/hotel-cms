const express = require('express');
const router = express.Router();
const bookingManagerController = require('../controllers/booking-manager.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');

// Channel management
router.post(
  '/channels',
  authMiddleware,
  requirePermission('CHANNEL_CREATE'),
  bookingManagerController.createChannel
);

router.get(
  '/channels/hotel/:hotel_id',
  authMiddleware,
  requirePermission('CHANNEL_VIEW'),
  bookingManagerController.getChannelsByHotel
);

router.get(
  '/channels/:channel_id',
  authMiddleware,
  requirePermission('CHANNEL_VIEW'),
  bookingManagerController.getChannelById
);

router.put(
  '/channels/:channel_id',
  authMiddleware,
  requirePermission('CHANNEL_UPDATE'),
  bookingManagerController.updateChannel
);

router.patch(
  '/channels/:channel_id/status',
  authMiddleware,
  requirePermission('CHANNEL_UPDATE'),
  bookingManagerController.toggleChannelStatus
);

router.delete(
  '/channels/:channel_id',
  authMiddleware,
  requirePermission('CHANNEL_DELETE'),
  bookingManagerController.deleteChannel
);

// Channel bookings
router.post(
  '/bookings',
  authMiddleware,
  requirePermission('CHANNEL_CREATE'),
  bookingManagerController.createChannelBooking
);

router.get(
  '/bookings/hotel/:hotel_id',
  authMiddleware,
  requirePermission('CHANNEL_VIEW'),
  bookingManagerController.getChannelBookings
);

router.patch(
  '/bookings/:booking_id/status',
  authMiddleware,
  requirePermission('CHANNEL_UPDATE'),
  bookingManagerController.updateChannelBookingStatus
);

// Stats
router.get(
  '/stats/hotel/:hotel_id',
  authMiddleware,
  requirePermission('CHANNEL_VIEW'),
  bookingManagerController.getChannelStats
);

module.exports = router;
