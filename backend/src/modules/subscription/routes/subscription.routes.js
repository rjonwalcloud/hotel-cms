const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission, requireRole } = require('../../../middleware/rbac.middleware');

// Plan management (Super Admin only)
router.post(
  '/plans',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  subscriptionController.createPlan
);

router.get(
  '/plans',
  authMiddleware,
  requirePermission('SUBSCRIPTION_VIEW'),
  subscriptionController.getAllPlans
);

router.get(
  '/plans/:plan_id',
  authMiddleware,
  requirePermission('SUBSCRIPTION_VIEW'),
  subscriptionController.getPlanById
);

router.put(
  '/plans/:plan_id',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  subscriptionController.updatePlan
);

// Subscription management
router.post(
  '/activate',
  authMiddleware,
  requirePermission('SUBSCRIPTION_ACTIVATE'),
  subscriptionController.activateSubscription
);

router.post(
  '/:subscription_id/renew',
  authMiddleware,
  requirePermission('SUBSCRIPTION_ACTIVATE'),
  subscriptionController.renewSubscription
);

router.post(
  '/:subscription_id/cancel',
  authMiddleware,
  requirePermission('SUBSCRIPTION_CANCEL'),
  subscriptionController.cancelSubscription
);

router.get(
  '/hotel/:hotel_id',
  authMiddleware,
  requirePermission('SUBSCRIPTION_VIEW'),
  subscriptionController.getHotelSubscription
);

router.get(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  subscriptionController.getAllSubscriptions
);

router.get(
  '/:subscription_id/history',
  authMiddleware,
  requirePermission('SUBSCRIPTION_VIEW'),
  subscriptionController.getSubscriptionHistory
);

module.exports = router;
