const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { checkQuota } = require('../../../middleware/quota.middleware');
const { requireActiveSubscription } = require('../../../middleware/subscription.middleware');

// Check room availability (public or authenticated)
router.get(
  '/check-availability',
  authMiddleware,
  bookingController.checkAvailability
);

// Create booking
router.post(
  '/',
  authMiddleware,
  requirePermission('BOOKING_CREATE'),
  requireActiveSubscription,
  checkQuota('booking_create'),
  bookingController.createBooking
);

// Create front desk booking (walk-in, direct check-in)
router.post(
  '/front-booking',
  authMiddleware,
  requirePermission('BOOKING_CREATE'),
  requireActiveSubscription,
  checkQuota('booking_create'),
  bookingController.createFrontBooking
);

// Get bookings for hotel
router.get(
  '/hotel/:hotel_id',
  authMiddleware,
  requirePermission('BOOKING_VIEW'),
  bookingController.getBookingsByHotel
);

// Export bookings
router.get(
  '/hotel/:hotel_id/export',
  authMiddleware,
  requirePermission('BOOKING_VIEW'),
  bookingController.exportBookings
);

// Get guests for hotel
router.get(
  '/guests/hotel/:hotel_id',
  authMiddleware,
  requirePermission('BOOKING_VIEW'),
  bookingController.getGuestsByHotel
);

// Get booking by ID
router.get(
  '/:booking_id',
  authMiddleware,
  requirePermission('BOOKING_VIEW'),
  bookingController.getBookingById
);

// Update booking status
router.patch(
  '/:booking_id/status',
  authMiddleware,
  requirePermission('BOOKING_UPDATE'),
  requireActiveSubscription,
  bookingController.updateBookingStatus
);

// Add payment
router.post(
  '/:booking_id/payment',
  authMiddleware,
  requirePermission('BOOKING_UPDATE'),
  bookingController.addPayment
);

// Cancel booking
router.post(
  '/:booking_id/cancel',
  authMiddleware,
  requirePermission('BOOKING_CANCEL'),
  bookingController.cancelBooking
);

// Check-in
router.post(
  '/:booking_id/checkin',
  authMiddleware,
  requirePermission('BOOKING_CHECKIN'),
  bookingController.checkIn
);

// Check-out
router.post(
  '/:booking_id/checkout',
  authMiddleware,
  requirePermission('BOOKING_CHECKOUT'),
  bookingController.checkOut
);

// Get billing summary (invoice)
router.get(
  '/:booking_id/billing',
  authMiddleware,
  requirePermission('BOOKING_VIEW'),
  bookingController.getBillingSummary
);

// Settle payment
router.post(
  '/:booking_id/settle-payment',
  authMiddleware,
  requirePermission('BOOKING_CHECKOUT'),
  bookingController.settlePayment
);

module.exports = router;
