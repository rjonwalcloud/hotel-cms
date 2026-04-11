const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission, requireAnyPermission } = require('../../../middleware/rbac.middleware');

// All routes are protected
router.use(authMiddleware);

// Categories
router.get('/categories', requirePermission('INVENTORY_VIEW'), inventoryController.getCategories);
router.post('/categories', requirePermission('INVENTORY_MANAGE'), inventoryController.createCategory);
router.put('/categories/:id', requirePermission('INVENTORY_MANAGE'), inventoryController.updateCategory);
router.delete('/categories/:id', requirePermission('INVENTORY_MANAGE'), inventoryController.deleteCategory);

// Items
router.get('/items', requirePermission('INVENTORY_VIEW'), inventoryController.getItems);
router.post('/items', requirePermission('INVENTORY_MANAGE'), inventoryController.createItem);
router.put('/items/:id', requirePermission('INVENTORY_MANAGE'), inventoryController.updateItem);
router.delete('/items/:id', requirePermission('INVENTORY_MANAGE'), inventoryController.deleteItem);

// Stock
router.get('/stock', requirePermission('INVENTORY_VIEW'), inventoryController.getStockLevels);
router.post('/stock/adjust', requirePermission('INVENTORY_STOCK_UPDATE'), inventoryController.adjustStockManual);

// Suppliers & POs
router.get('/suppliers', requirePermission('INVENTORY_PO_MANAGE'), inventoryController.getSuppliers);
router.post('/suppliers', requirePermission('INVENTORY_PO_MANAGE'), inventoryController.createSupplier);

router.get('/purchase-orders', requirePermission('INVENTORY_PO_MANAGE'), inventoryController.getPOs);
router.post('/purchase-orders', requirePermission('INVENTORY_PO_MANAGE'), inventoryController.createPurchaseOrder);
router.get('/purchase-orders/:poId', requirePermission('INVENTORY_PO_MANAGE'), inventoryController.getPODetail);
router.post('/purchase-orders/:poId/receive', requirePermission('INVENTORY_PO_MANAGE'), inventoryController.receivePO);

// Breakage & Expenses
router.get('/breakage-report', requireAnyPermission(['INVENTORY_BREAKAGE_REPORT', 'INVENTORY_STOCK_UPDATE']), inventoryController.getBreakageReports);
router.post('/breakage-report', requireAnyPermission(['INVENTORY_BREAKAGE_REPORT', 'INVENTORY_STOCK_UPDATE']), inventoryController.reportBreakage);
router.get('/expenses', requirePermission('INVENTORY_EXPENSE_MANAGE'), inventoryController.getExpenses);
router.post('/expenses', requirePermission('INVENTORY_EXPENSE_MANAGE'), inventoryController.logExpense);

module.exports = router;
