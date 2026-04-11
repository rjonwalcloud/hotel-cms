const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');

// ============================================
// CATEGORY ROUTES
// ============================================

// Create category
router.post(
  '/categories',
  authMiddleware,
  requirePermission('SERVICE_CREATE'),
  serviceController.createCategory
);

// Get categories by hotel
router.get(
  '/categories/hotel/:hotel_id',
  authMiddleware,
  requirePermission('SERVICE_VIEW'),
  serviceController.getCategoriesByHotel
);

// Update category
router.put(
  '/categories/:category_id',
  authMiddleware,
  requirePermission('SERVICE_UPDATE'),
  serviceController.updateCategory
);

// Delete category
router.delete(
  '/categories/:category_id',
  authMiddleware,
  requirePermission('SERVICE_DELETE'),
  serviceController.deleteCategory
);

// ============================================
// SERVICE ITEM ROUTES
// ============================================

// Create service item
router.post(
  '/items',
  authMiddleware,
  requirePermission('SERVICE_CREATE'),
  serviceController.createItem
);

// Get items by hotel
router.get(
  '/items/hotel/:hotel_id',
  authMiddleware,
  requirePermission('SERVICE_VIEW'),
  serviceController.getItemsByHotel
);

// Get item by ID
router.get(
  '/items/:item_id',
  authMiddleware,
  requirePermission('SERVICE_VIEW'),
  serviceController.getItemById
);

// Update service item
router.put(
  '/items/:item_id',
  authMiddleware,
  requirePermission('SERVICE_UPDATE'),
  serviceController.updateItem
);

// Toggle item availability (Staff can do this)
router.patch(
  '/items/:item_id/availability',
  authMiddleware,
  requirePermission('SERVICE_VIEW'), // Staff has SERVICE_VIEW
  serviceController.toggleItemAvailability
);

// Delete service item
router.delete(
  '/items/:item_id',
  authMiddleware,
  requirePermission('SERVICE_DELETE'),
  serviceController.deleteItem
);

module.exports = router;
