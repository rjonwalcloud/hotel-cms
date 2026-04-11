const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission, requireRole } = require('../../../middleware/rbac.middleware');

// Get audit logs for hotel
router.get(
  '/hotel/:hotel_id',
  authMiddleware,
  requirePermission('AUDIT_VIEW'),
  auditController.getAuditLogsByHotel
);

// Get audit log by ID
router.get(
  '/log/:log_id',
  authMiddleware,
  requirePermission('AUDIT_VIEW'),
  auditController.getAuditLogById
);

// Get entity history
router.get(
  '/entity/:entity_type/:entity_id',
  authMiddleware,
  requirePermission('AUDIT_VIEW'),
  auditController.getEntityHistory
);

// Get audit statistics
router.get(
  '/hotel/:hotel_id/stats',
  authMiddleware,
  requirePermission('AUDIT_VIEW'),
  auditController.getAuditStats
);

// Get user activity
router.get(
  '/user/:user_id/activity',
  authMiddleware,
  requirePermission('AUDIT_VIEW'),
  auditController.getUserActivity
);

// Get all audit logs (Super Admin only)
router.get(
  '/all',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  auditController.getAllAuditLogs
);

// Export all audit logs (Super Admin only)
router.get(
  '/export/all',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  auditController.exportAllAuditLogs
);

// Export audit logs
router.get(
  '/hotel/:hotel_id/export',
  authMiddleware,
  requirePermission('AUDIT_VIEW'),
  auditController.exportAuditLogs
);

module.exports = router;
