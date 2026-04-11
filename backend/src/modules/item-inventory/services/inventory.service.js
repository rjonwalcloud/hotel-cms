const db = require('../../../config/database');

class InventoryService {
    // ============================================
    // CATEGORIES & ITEMS
    // ============================================

    async getCategories(hotelId) {
        const query = 'SELECT * FROM inventory_categories WHERE hotel_id = $1 ORDER BY name';
        const result = await db.query(query, [hotelId]);
        return result.rows;
    }

    async createCategory(hotelId, data) {
        const { name, description } = data;
        const query = `
            INSERT INTO inventory_categories (hotel_id, name, description)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const result = await db.query(query, [hotelId, name, description]);
        return result.rows[0];
    }

    async updateCategory(hotelId, categoryId, data) {
        const { name, description } = data;
        const result = await db.query(
            `UPDATE inventory_categories SET name = $1, description = $2 WHERE id = $3 AND hotel_id = $4 RETURNING *`,
            [name, description || null, categoryId, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Category not found');
        return result.rows[0];
    }

    async deleteCategory(hotelId, categoryId) {
        const items = await db.query('SELECT id FROM inventory_items WHERE category_id = $1 AND hotel_id = $2 LIMIT 1', [categoryId, hotelId]);
        if (items.rows.length > 0) throw new Error('Cannot delete category with existing items. Remove or reassign items first.');
        const result = await db.query('DELETE FROM inventory_categories WHERE id = $1 AND hotel_id = $2 RETURNING id', [categoryId, hotelId]);
        if (result.rows.length === 0) throw new Error('Category not found');
        return true;
    }

    async getItems(hotelId, params = {}) {
        const { category_id, search } = params;
        let query = `
            SELECT i.*, c.name as category_name,
                   COALESCE(SUM(s.quantity), 0) as total_stock
            FROM inventory_items i
            LEFT JOIN inventory_categories c ON c.id = i.category_id
            LEFT JOIN inventory_stock s ON s.item_id = i.id
            WHERE i.hotel_id = $1
        `;
        const values = [hotelId];
        let idx = 2;

        if (category_id) {
            query += ` AND i.category_id = $${idx++}`;
            values.push(category_id);
        }

        if (search) {
            query += ` AND (i.name ILIKE $${idx} OR i.sku ILIKE $${idx})`;
            values.push(`%${search}%`);
            idx++;
        }

        query += ' GROUP BY i.id, c.name ORDER BY i.name';
        const result = await db.query(query, values);
        return result.rows;
    }

    async createItem(hotelId, data) {
        const { category_id, name, sku, unit, min_stock_level, price, description } = data;
        const query = `
            INSERT INTO inventory_items (hotel_id, category_id, name, sku, unit, min_stock_level, price, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const result = await db.query(query, [hotelId, category_id, name, sku, unit, min_stock_level || 0, price || 0, description]);
        return result.rows[0];
    }

    async updateItem(hotelId, itemId, data) {
        const { category_id, name, sku, unit, min_stock_level, price, description } = data;
        const result = await db.query(
            `UPDATE inventory_items SET category_id = $1, name = $2, sku = $3, unit = $4, min_stock_level = $5, price = $6, description = $7
             WHERE id = $8 AND hotel_id = $9 RETURNING *`,
            [category_id, name, sku || null, unit, min_stock_level || 0, price || 0, description || null, itemId, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Item not found');
        return result.rows[0];
    }

    async deleteItem(hotelId, itemId) {
        const stock = await db.query('SELECT id FROM inventory_stock WHERE item_id = $1 AND quantity > 0 LIMIT 1', [itemId]);
        if (stock.rows.length > 0) throw new Error('Cannot delete item with existing stock. Adjust stock to zero first.');
        const result = await db.query('DELETE FROM inventory_items WHERE id = $1 AND hotel_id = $2 RETURNING id', [itemId, hotelId]);
        if (result.rows.length === 0) throw new Error('Item not found');
        return true;
    }

    // ============================================
    // STOCK
    // ============================================

    /**
     * Get or create a default store for this hotel (internal use only).
     * The store concept is hidden from the UI — one auto-managed store per hotel.
     */
    async getDefaultStoreId(hotelId, client = db) {
        const existing = await client.query(
            'SELECT id FROM inventory_stores WHERE hotel_id = $1 LIMIT 1', [hotelId]
        );
        if (existing.rows.length > 0) return existing.rows[0].id;

        const created = await client.query(
            `INSERT INTO inventory_stores (hotel_id, name, description) VALUES ($1, 'Default', 'Auto-created default store') RETURNING id`,
            [hotelId]
        );
        return created.rows[0].id;
    }

    async getStockLevels(hotelId) {
        const query = `
            SELECT s.*, i.name as item_name, i.unit, i.sku, i.min_stock_level,
                   c.name as category_name
            FROM inventory_stock s
            JOIN inventory_items i ON i.id = s.item_id
            LEFT JOIN inventory_categories c ON c.id = i.category_id
            WHERE s.hotel_id = $1
            ORDER BY i.name
        `;
        const result = await db.query(query, [hotelId]);
        return result.rows;
    }

    /**
     * Core method to adjust stock and record movement
     */
    async adjustStock(hotelId, data, userId, client = db) {
        const {
            item_id,
            store_id,
            quantity,
            movement_type,
            reference_id = null,
            notes = ''
        } = data;

        // Use provided store_id or auto-resolve the default store
        const targetStoreId = store_id || await this.getDefaultStoreId(hotelId, client);

        await client.query(`
            INSERT INTO inventory_stock (hotel_id, store_id, item_id, quantity)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (store_id, item_id)
            DO UPDATE SET
                quantity = inventory_stock.quantity + EXCLUDED.quantity,
                updated_at = CURRENT_TIMESTAMP
        `, [hotelId, targetStoreId, item_id, quantity]);

        await client.query(`
            INSERT INTO inventory_stock_movements (
                hotel_id, item_id, from_store_id, to_store_id,
                quantity, movement_type, reference_id, performed_by, notes
            )
            VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8)
        `, [hotelId, item_id, targetStoreId, quantity, movement_type, reference_id, userId, notes]);

        return true;
    }

    // ============================================
    // SUPPLIERS & PURCHASE ORDERS
    // ============================================

    async getSuppliers(hotelId) {
        const query = 'SELECT * FROM inventory_suppliers WHERE hotel_id = $1 ORDER BY name';
        const result = await db.query(query, [hotelId]);
        return result.rows;
    }

    async createSupplier(hotelId, data) {
        const { name, contact_person, phone, email, address } = data;
        const query = `
            INSERT INTO inventory_suppliers (hotel_id, name, contact_person, phone, email, address)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const result = await db.query(query, [hotelId, name, contact_person || null, phone || null, email || null, address || null]);
        return result.rows[0];
    }

    async getPOs(hotelId) {
        const query = `
            SELECT po.*, s.name as supplier_name,
                   u.full_name as created_by_name,
                   ru.full_name as received_by_name,
                   (SELECT COUNT(*) FROM inventory_po_items WHERE po_id = po.id) as item_count,
                   (SELECT string_agg(i.name, ', ') FROM inventory_po_items pi JOIN inventory_items i ON i.id = pi.item_id WHERE pi.po_id = po.id) as item_names
            FROM inventory_purchase_orders po
            LEFT JOIN inventory_suppliers s ON s.id = po.supplier_id
            LEFT JOIN users u ON u.id = po.created_by
            LEFT JOIN users ru ON ru.id = po.received_by
            WHERE po.hotel_id = $1
            ORDER BY po.created_at DESC
        `;
        const result = await db.query(query, [hotelId]);
        return result.rows;
    }

    async getPODetail(hotelId, poId) {
        const poQuery = `
            SELECT po.*, s.name as supplier_name, s.contact_person as supplier_contact,
                   s.phone as supplier_phone, s.email as supplier_email, s.address as supplier_address,
                   u.full_name as created_by_name, ru.full_name as received_by_name,
                   h.name as hotel_name
            FROM inventory_purchase_orders po
            LEFT JOIN inventory_suppliers s ON s.id = po.supplier_id
            LEFT JOIN users u ON u.id = po.created_by
            LEFT JOIN users ru ON ru.id = po.received_by
            LEFT JOIN hotels h ON h.id = po.hotel_id
            WHERE po.id = $1 AND po.hotel_id = $2
        `;
        const poResult = await db.query(poQuery, [poId, hotelId]);
        if (poResult.rows.length === 0) throw new Error('PO not found');

        const itemsQuery = `
            SELECT pi.*, i.name as item_name, i.sku, i.unit
            FROM inventory_po_items pi
            JOIN inventory_items i ON i.id = pi.item_id
            WHERE pi.po_id = $1
            ORDER BY i.name
        `;
        const itemsResult = await db.query(itemsQuery, [poId]);

        return { ...poResult.rows[0], items: itemsResult.rows };
    }

    async createPurchaseOrder(hotelId, data, userId) {
        const { supplier_id, po_number, items, notes } = data;
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const autoPoNumber = po_number || `PO-${Date.now()}`;
            const poResult = await client.query(`
                INSERT INTO inventory_purchase_orders (hotel_id, supplier_id, po_number, status, notes, created_by)
                VALUES ($1, $2, $3, 'DRAFT', $4, $5)
                RETURNING *
            `, [hotelId, supplier_id, autoPoNumber, notes || null, userId]);

            const poId = poResult.rows[0].id;

            // Support both array of items and single-item form
            const itemsList = Array.isArray(items) ? items : [{
                item_id: data.item_id,
                quantity: data.quantity,
                unit_price: data.unit_price
            }];

            let totalAmount = 0;
            for (const item of itemsList) {
                const itemTotal = parseFloat(item.quantity) * parseFloat(item.unit_price);
                totalAmount += itemTotal;
                await client.query(`
                    INSERT INTO inventory_po_items (po_id, item_id, quantity, unit_price, total_price)
                    VALUES ($1, $2, $3, $4, $5)
                `, [poId, item.item_id, item.quantity, item.unit_price, itemTotal]);
            }

            await client.query('UPDATE inventory_purchase_orders SET total_amount = $1 WHERE id = $2', [totalAmount, poId]);
            await client.query('COMMIT');
            return { ...poResult.rows[0], total_amount: totalAmount };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async receivePO(hotelId, poId, storeId, userId, receivedItems = []) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const poRes = await client.query(
                'SELECT status FROM inventory_purchase_orders WHERE id = $1 AND hotel_id = $2',
                [poId, hotelId]
            );
            if (poRes.rows.length === 0) throw new Error('PO not found');
            if (poRes.rows[0].status === 'RECEIVED') throw new Error('PO already received');

            // Use provided store or auto-resolve default
            const resolvedStoreId = storeId || await this.getDefaultStoreId(hotelId, client);
            const itemsRes = await client.query('SELECT * FROM inventory_po_items WHERE po_id = $1', [poId]);

            // Build a map of received quantities/remarks from frontend
            const receivedMap = {};
            if (Array.isArray(receivedItems) && receivedItems.length > 0) {
                receivedItems.forEach(ri => {
                    receivedMap[ri.po_item_id] = {
                        received_quantity: parseFloat(ri.received_quantity),
                        remarks: ri.remarks || ''
                    };
                });
            }

            let actualTotal = 0;
            for (const item of itemsRes.rows) {
                // Use received qty if provided, otherwise default to ordered qty
                const received = receivedMap[item.id];
                const recvQty = received ? received.received_quantity : parseFloat(item.quantity);
                const remarks = received ? received.remarks : '';

                // Update po_item with received_quantity and remarks
                await client.query(
                    'UPDATE inventory_po_items SET received_quantity = $1, remarks = $2 WHERE id = $3',
                    [recvQty, remarks || null, item.id]
                );

                // Adjust stock by actual received quantity
                if (recvQty > 0) {
                    await this.adjustStock(hotelId, {
                        item_id: item.item_id,
                        store_id: resolvedStoreId,
                        quantity: recvQty,
                        movement_type: 'PO_RECEIVE',
                        reference_id: poId,
                        notes: `Received from PO: ${poId}${remarks ? ` — ${remarks}` : ''}`
                    }, userId, client);
                }

                actualTotal += recvQty * parseFloat(item.unit_price);
            }

            await client.query(
                "UPDATE inventory_purchase_orders SET status = 'RECEIVED', received_by = $2, received_at = CURRENT_TIMESTAMP, received_amount = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [poId, userId, actualTotal]
            );

            // Auto-log PO as expense (based on actual received amount)
            const poDetail = await client.query(
                `SELECT po.po_number, po.total_amount, s.name as supplier_name
                 FROM inventory_purchase_orders po
                 LEFT JOIN inventory_suppliers s ON s.id = po.supplier_id
                 WHERE po.id = $1`, [poId]
            );
            if (poDetail.rows.length > 0) {
                const po = poDetail.rows[0];
                const expenseAmount = actualTotal || parseFloat(po.total_amount);
                await client.query(`
                    INSERT INTO inventory_expenses (hotel_id, category, amount, description, expense_date, payment_method, created_by)
                    VALUES ($1, 'Purchase Order', $2, $3, CURRENT_DATE, 'PO', $4)
                `, [hotelId, expenseAmount, `PO #${po.po_number} — ${po.supplier_name || 'Supplier'}`, userId]);
            }

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================
    // BREAKAGE & EXPENSES
    // ============================================

    async getBreakageReports(hotelId) {
        const query = `
            SELECT br.*, i.name as item_name, i.unit, i.price as item_price,
                   c.name as category_name, u.full_name as reported_by_name
            FROM inventory_breakage_reports br
            LEFT JOIN inventory_items i ON i.id = br.item_id
            LEFT JOIN inventory_categories c ON c.id = i.category_id
            LEFT JOIN users u ON u.id = br.reported_by
            WHERE br.hotel_id = $1
            ORDER BY br.created_at DESC
        `;
        const result = await db.query(query, [hotelId]);
        return result.rows;
    }

    async reportBreakage(hotelId, data, userId) {
        const { item_id, store_id, quantity, type, reason, notes } = data;
        const breakageType = type || reason || 'BREAKAGE';
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Use provided store or auto-resolve default
            const resolvedStoreId = store_id || await this.getDefaultStoreId(hotelId, client);

            const reportRes = await client.query(`
                INSERT INTO inventory_breakage_reports (hotel_id, item_id, store_id, quantity, type, reported_by, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [hotelId, item_id, resolvedStoreId, quantity, breakageType, userId, notes || null]);

            await this.adjustStock(hotelId, {
                item_id,
                store_id: resolvedStoreId,
                quantity: -Math.abs(quantity),
                movement_type: 'BREAKAGE',
                reference_id: reportRes.rows[0].id,
                notes: `${breakageType}: ${notes}`
            }, userId, client);

            await client.query('COMMIT');
            return reportRes.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getExpenses(hotelId) {
        const query = `
            SELECT e.*, u.full_name as created_by_name
            FROM inventory_expenses e
            LEFT JOIN users u ON u.id = e.created_by
            WHERE e.hotel_id = $1
            ORDER BY e.expense_date DESC, e.created_at DESC
        `;
        const result = await db.query(query, [hotelId]);
        return result.rows;
    }

    async logExpense(hotelId, data, userId) {
        const { category, category_id, amount, description, expense_date, payment_method } = data;
        const categoryValue = category || category_id || 'General';
        const query = `
            INSERT INTO inventory_expenses (hotel_id, category, amount, description, expense_date, payment_method, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const result = await db.query(query, [
            hotelId, categoryValue, amount, description,
            expense_date || new Date(), payment_method || null, userId
        ]);
        return result.rows[0];
    }
}

module.exports = new InventoryService();
