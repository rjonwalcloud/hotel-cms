const inventoryService = require('../services/inventory.service');

class InventoryController {
    // Categories
    async getCategories(req, res) {
        try {
            const categories = await inventoryService.getCategories(req.user.hotel_id);
            res.json(categories);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createCategory(req, res) {
        try {
            const category = await inventoryService.createCategory(req.user.hotel_id, req.body);
            res.status(201).json(category);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateCategory(req, res) {
        try {
            const category = await inventoryService.updateCategory(req.user.hotel_id, req.params.id, req.body);
            res.json(category);
        } catch (error) {
            res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
        }
    }

    async deleteCategory(req, res) {
        try {
            await inventoryService.deleteCategory(req.user.hotel_id, req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
        }
    }

    // Items
    async getItems(req, res) {
        try {
            const items = await inventoryService.getItems(req.user.hotel_id, req.query);
            res.json(items);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createItem(req, res) {
        try {
            const item = await inventoryService.createItem(req.user.hotel_id, req.body);
            res.status(201).json(item);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateItem(req, res) {
        try {
            const item = await inventoryService.updateItem(req.user.hotel_id, req.params.id, req.body);
            res.json(item);
        } catch (error) {
            res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
        }
    }

    async deleteItem(req, res) {
        try {
            await inventoryService.deleteItem(req.user.hotel_id, req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
        }
    }

    // Stock
    async getStockLevels(req, res) {
        try {
            const stock = await inventoryService.getStockLevels(req.user.hotel_id, req.query);
            res.json(stock);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async adjustStockManual(req, res) {
        try {
            const { item_id, type, quantity, notes } = req.body;
            const hotelId = req.user.hotel_id;
            const userId = req.user.id;

            await inventoryService.adjustStock(hotelId, {
                ...req.body,
                movement_type: type === 'OUT' ? 'OUT' : 'IN',
                quantity: type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity)
            }, userId);

            // Auto-log expense for manual stock IN
            if (type === 'IN' && item_id) {
                try {
                    await inventoryService.logExpense(hotelId, {
                        category: 'Stock Adjustment',
                        amount: req.body.total_cost || 0,
                        description: `Manual stock IN: ${notes || 'No remarks'}`,
                        expense_date: new Date(),
                        payment_method: req.body.payment_method || 'Cash'
                    }, userId);
                } catch (e) { /* expense logging is best-effort */ }
            }

            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Suppliers
    async getSuppliers(req, res) {
        try {
            const suppliers = await inventoryService.getSuppliers(req.user.hotel_id);
            res.json(suppliers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createSupplier(req, res) {
        try {
            const supplier = await inventoryService.createSupplier(req.user.hotel_id, req.body);
            res.status(201).json(supplier);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Purchase Orders
    async getPOs(req, res) {
        try {
            const pos = await inventoryService.getPOs(req.user.hotel_id);
            res.json(pos);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getPODetail(req, res) {
        try {
            const po = await inventoryService.getPODetail(req.user.hotel_id, req.params.poId);
            res.json(po);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createPurchaseOrder(req, res) {
        try {
            const po = await inventoryService.createPurchaseOrder(req.user.hotel_id, req.body, req.user.id);
            res.status(201).json(po);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async receivePO(req, res) {
        try {
            const { poId } = req.params;
            const { store_id, items } = req.body;
            await inventoryService.receivePO(req.user.hotel_id, poId, store_id || null, req.user.id, items || []);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Breakage & Expenses
    async getBreakageReports(req, res) {
        try {
            const reports = await inventoryService.getBreakageReports(req.user.hotel_id);
            res.json(reports);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async reportBreakage(req, res) {
        try {
            const report = await inventoryService.reportBreakage(req.user.hotel_id, req.body, req.user.id);
            res.status(201).json(report);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getExpenses(req, res) {
        try {
            const expenses = await inventoryService.getExpenses(req.user.hotel_id);
            res.json(expenses);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async logExpense(req, res) {
        try {
            const expense = await inventoryService.logExpense(req.user.hotel_id, req.body, req.user.id);
            res.status(201).json(expense);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new InventoryController();
