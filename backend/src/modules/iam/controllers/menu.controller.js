const userService = require('../services/user.service');

class MenuController {
    /**
     * Update menu visibility for users or roles
     * POST /api/users/menu-visibility
     */
    async updateVisibility(req, res) {
        try {
            const { hotelIds, roleName, userIds, hiddenMenuItems } = req.body;

            if (!hiddenMenuItems || !Array.isArray(hiddenMenuItems)) {
                return res.status(400).json({ error: 'hiddenMenuItems array is required' });
            }

            const result = await userService.updateMenuVisibility({
                hotelIds,
                roleName,
                userIds,
                hiddenMenuItems
            });

            res.json(result);
        } catch (error) {
            console.error('Error updating menu visibility:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new MenuController();
