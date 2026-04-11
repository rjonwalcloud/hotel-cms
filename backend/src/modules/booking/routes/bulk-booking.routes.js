const express = require('express');
const router = express.Router();
const bulkBookingController = require('../controllers/bulk-booking.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { requireActiveSubscription } = require('../../../middleware/subscription.middleware');

// Create bulk booking
router.post(
    '/hotel/:hotel_id',
    authMiddleware,
    requirePermission('BOOKING_CREATE'),
    requireActiveSubscription,
    bulkBookingController.createBulkBooking
);

// Get bulk bookings
router.get(
    '/hotel/:hotel_id',
    authMiddleware,
    requirePermission('BOOKING_VIEW'),
    bulkBookingController.getBulkBookings
);

// Get a single bulk booking
router.get(
    '/:id/hotel/:hotel_id',
    authMiddleware,
    requirePermission('BOOKING_VIEW'),
    bulkBookingController.getBulkBookingById
);

// Update status
router.patch(
    '/:id/status/hotel/:hotel_id',
    authMiddleware,
    requirePermission('BOOKING_UPDATE'),
    bulkBookingController.updateStatus
);

// Get combined invoice
router.get(
    '/:id/invoice/hotel/:hotel_id',
    authMiddleware,
    requirePermission('BOOKING_VIEW'),
    bulkBookingController.getInvoice
);

// Update bulk billing
router.patch(
    '/:id/billing/hotel/:hotel_id',
    authMiddleware,
    requirePermission('BOOKING_UPDATE'),
    bulkBookingController.updateBilling
);

// Settle Payment / Checkout
router.post(
    '/:id/checkout/hotel/:hotel_id',
    authMiddleware,
    requirePermission('BOOKING_UPDATE'),
    bulkBookingController.settlePayment
);

module.exports = router;
