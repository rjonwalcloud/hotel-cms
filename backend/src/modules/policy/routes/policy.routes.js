const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policy.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission, requireRole } = require('../../../middleware/rbac.middleware');

// Get all policy limits (Super Admin)
router.get(
  '/limits',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  policyController.getAllPolicyLimits
);

// Get hotel limits
router.get(
  '/hotel/:hotel_id/limits',
  authMiddleware,
  policyController.getHotelLimits
);

// Set hotel limit (Super Admin only)
router.post(
  '/hotel/:hotel_id/limits',
  authMiddleware,
  requirePermission('LIMIT_OVERRIDE'),
  policyController.setHotelLimit
);

// Get usage stats for hotel
router.get(
  '/hotel/:hotel_id/usage',
  authMiddleware,
  policyController.getUsageStats
);

// Reset usage counter (Super Admin only)
router.post(
  '/hotel/:hotel_id/reset-counter',
  authMiddleware,
  requirePermission('LIMIT_OVERRIDE'),
  policyController.resetUsageCounter
);

// Get quota summary for all hotels (Super Admin only)
router.get(
  '/quota-summary',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  policyController.getQuotaSummaryAllHotels
);

module.exports = router;
