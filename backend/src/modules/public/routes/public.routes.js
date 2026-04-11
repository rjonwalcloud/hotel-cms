const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

// GET /api/public/hotels/:hotel_id
router.get('/hotels/:hotel_id', publicController.getHotelInfo);

// GET /api/public/system-configs
router.get('/system-configs', publicController.getSystemConfigs);

// GET /api/public/availability?hotel_id=...&check_in=...&check_out=...&adults=...
router.get('/availability', publicController.searchAvailability);

// POST /api/public/bookings
router.post('/bookings', publicController.createBooking);

// GET /api/public/bookings/:booking_ref
router.get('/bookings/:booking_ref', publicController.getBooking);

// POST /api/public/bookings/:booking_ref/cancel
router.post('/bookings/:booking_ref/cancel', publicController.cancelBooking);

// POST /api/public/validate-coupon (no auth — for QR service page)
router.post('/validate-coupon', async (req, res, next) => {
    try {
        const { code, hotel_id, amount, nights, room_type_id } = req.body;
        if (!code || !hotel_id) {
            return res.status(400).json({ success: false, message: 'code and hotel_id required' });
        }
        const promotionService = require('../../promotion/services/promotion.service');
        const result = await promotionService.validateCoupon(code, hotel_id, amount || 0, nights || 1, room_type_id);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET /api/public/diagnostics (Temporary debug endpoint)
router.get('/diagnostics', async (req, res) => {
    try {
        const db = require('../../../config/database');
        const tables = [
            'hotels', 'users', 'user_roles', 'roles',
            'hotel_settings', 'taxes', 'service_categories',
            'booking_channels', 'channel_bookings', 'qr_codes',
            'policy_limits', 'hotel_limits', 'usage_counters'
        ];
        const results = {};

        for (const table of tables) {
            const check = await db.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`, [table]);
            results[table] = check.rows[0].exists;
        }

        // Check user_roles columns
        let userRolesColumns = [];
        try {
            const colCheck = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_roles' ORDER BY ordinal_position`);
            userRolesColumns = colCheck.rows;
        } catch (e) {
            userRolesColumns = [{ error: e.message }];
        }

        // Test listing users for first hotel
        let userListTest = null;
        try {
            const firstHotel = await db.query('SELECT id, name FROM hotels LIMIT 1');
            if (firstHotel.rows.length > 0) {
                const hotelId = firstHotel.rows[0].id;
                const userQuery = `
                    SELECT u.id, u.email, u.full_name, r.name as role_name, ur.hotel_id
                    FROM users u
                    LEFT JOIN user_roles ur ON ur.user_id = u.id
                    LEFT JOIN roles r ON r.id = ur.role_id
                    ORDER BY u.created_at DESC
                    LIMIT 10
                `;
                const usersRes = await db.query(userQuery);
                userListTest = {
                    hotel: firstHotel.rows[0],
                    users: usersRes.rows,
                    count: usersRes.rows.length
                };
            } else {
                userListTest = { error: 'No hotels found' };
            }
        } catch (e) {
            userListTest = { error: e.message };
        }

        // Check policy_limits keys
        let policyKeys = [];
        try {
            const plRes = await db.query('SELECT key, scope FROM policy_limits ORDER BY key');
            policyKeys = plRes.rows;
        } catch (e) {
            policyKeys = [{ error: e.message }];
        }

        res.json({
            success: true,
            message: 'Diagnostic run complete',
            tables_exist: results,
            user_roles_columns: userRolesColumns,
            user_list_test: userListTest,
            policy_limit_keys: policyKeys
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
});

module.exports = router;
