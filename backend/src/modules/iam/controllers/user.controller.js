const userService = require('../services/user.service');

class UserController {
    /**
     * Get users for a hotel
     */
    async listUsers(req, res) {
        try {
            const { hotel_id } = req.params;
            const users = await userService.listUsersByHotel(hotel_id);
            res.json({
                success: true,
                users
            });
        } catch (error) {
            console.error('listUsers error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get all available permissions
     */
    async listPermissions(req, res) {
        try {
            // Permissions are global, so we can just query them directly without going through user service
            // for simplicity since this is a simple static fetch
            const db = require('../../../config/database');
            const result = await db.query('SELECT key, description, module FROM permissions ORDER BY module, key');
            res.json({
                success: true,
                permissions: result.rows
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Create user
     */
    async create(req, res) {
        try {
            const user = await userService.createUser(req.body, req.user.id);
            res.status(201).json({
                success: true,
                message: 'User created successfully',
                user
            });
        } catch (error) {
            console.error('createUser error:', error);
            res.status(error.message.includes('limit') ? 403 : 400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Update user
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const { hotel_id } = req.body;
            const user = await userService.updateUser(id, hotel_id, req.body);
            res.json({
                success: true,
                message: 'User updated successfully',
                user
            });
        } catch (error) {
            console.error('updateUser error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Delete user
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const { hotel_id } = req.query; // Expecting hotel_id in query params for quota decrement

            if (!hotel_id) {
                return res.status(400).json({ success: false, message: 'hotel_id is required' });
            }

            await userService.deleteUser(id, hotel_id);
            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        } catch (error) {
            console.error('deleteUser error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new UserController();
