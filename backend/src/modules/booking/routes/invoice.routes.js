const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requireAnyRole } = require('../../../middleware/rbac.middleware');

// All invoice routes require authentication and appropriate roles
router.use(authMiddleware);
router.use(requireAnyRole(['SUPER_ADMIN', 'HOTEL_ADMIN', 'STAFF']));

router.get('/bookings', invoiceController.getBookingInvoices);
router.get('/qr-services', invoiceController.getServiceInvoices);
router.get('/all', invoiceController.getAllInvoices);

module.exports = router;
