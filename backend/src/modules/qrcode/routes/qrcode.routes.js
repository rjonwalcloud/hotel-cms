const express = require('express');
const router = express.Router();
const qrcodeController = require('../controllers/qrcode.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission, requireAnyPermission } = require('../../../middleware/rbac.middleware');

// Public endpoints (accessed via QR scan - no auth required)
router.get('/scan/:token', qrcodeController.scanQRCode);
router.get('/scan/:token/orders', qrcodeController.getGuestOrders);
router.post('/scan/:token/request', qrcodeController.createServiceRequest);
router.post('/scan/:token/request/bulk', qrcodeController.createBulkServiceRequests);

// Protected endpoints
router.post(
  '/generate',
  authMiddleware,
  requirePermission('QRCODE_GENERATE'),
  qrcodeController.generateQRCode
);

router.post(
  '/bulk-generate',
  authMiddleware,
  requirePermission('QRCODE_GENERATE'),
  qrcodeController.bulkGenerate
);

router.get(
  '/hotel/:hotel_id',
  authMiddleware,
  requirePermission('QRCODE_VIEW'),
  qrcodeController.getByHotel
);

router.get(
  '/requests/hotel/:hotel_id',
  authMiddleware,
  requireAnyPermission(['QRCODE_VIEW', 'SERVICE_REQUEST_VIEW']),
  qrcodeController.getServiceRequests
);

router.post(
  '/requests/hotel/:hotel_id/bulk',
  authMiddleware,
  requireAnyPermission(['SERVICE_REQUEST_UPDATE', 'BOOKING_UPDATE']),
  qrcodeController.createBulkServiceRequestsStaff
);

router.patch(
  '/requests/bulk-status',
  authMiddleware,
  requireAnyPermission(['QRCODE_GENERATE', 'SERVICE_REQUEST_UPDATE']),
  qrcodeController.bulkUpdateServiceRequestStatus
);

router.patch(
  '/requests/:request_id/status',
  authMiddleware,
  requireAnyPermission(['QRCODE_GENERATE', 'SERVICE_REQUEST_UPDATE']),
  qrcodeController.updateServiceRequestStatus
);

router.get(
  '/requests/:request_id/details',
  authMiddleware,
  requireAnyPermission(['QRCODE_VIEW', 'SERVICE_REQUEST_VIEW']),
  qrcodeController.getServiceRequestDetails
);

router.patch(
  '/:qr_id/status',
  authMiddleware,
  requirePermission('QRCODE_GENERATE'),
  qrcodeController.toggleQRCodeStatus
);

router.delete(
  '/:qr_id',
  authMiddleware,
  requirePermission('QRCODE_DELETE'),
  qrcodeController.deleteQRCode
);

module.exports = router;
