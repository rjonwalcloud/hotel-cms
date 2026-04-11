const settingsService = require('../services/settings.service');

class SettingsController {
    /**
     * Helper to get hotel_id from request and verify user has access to it.
     * Fallbacks to req.user.hotel_id (default context).
     */
    getAuthorizedHotelId = (req) => {
        const paramHotelId = req.query.hotel_id || req.body.hotel_id;

        // If an explicit hotel_id is provided, verify the user has access to it
        if (paramHotelId) {
            const hasAccess = req.user.roles.some(r =>
                r.role === 'SUPER_ADMIN' || r.hotel_id === paramHotelId
            );
            if (hasAccess) return paramHotelId;
        }

        // Fallback to default context attached by authMiddleware
        return req.user.hotel_id;
    }

    /**
     * Get hotel settings
     */
    getSettings = async (req, res, next) => {
        try {
            const hotelId = this.getAuthorizedHotelId(req);
            if (!hotelId) return res.status(400).json({ error: 'hotel_id is required' });

            const settings = await settingsService.getSettings(hotelId);
            res.json(settings);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update hotel settings
     */
    updateSettings = async (req, res, next) => {
        try {
            const hotelId = this.getAuthorizedHotelId(req);
            if (!hotelId) return res.status(400).json({ error: 'hotel_id is required' });

            const userId = req.user.id;
            const settings = await settingsService.updateSettings(hotelId, req.body, userId);
            res.json(settings);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all taxes
     */
    getTaxes = async (req, res, next) => {
        try {
            const hotelId = this.getAuthorizedHotelId(req);
            if (!hotelId) return res.status(400).json({ error: 'hotel_id is required' });

            const taxes = await settingsService.getTaxes(hotelId);
            res.json(taxes);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create a tax
     */
    createTax = async (req, res, next) => {
        try {
            const hotelId = this.getAuthorizedHotelId(req);
            if (!hotelId) return res.status(400).json({ error: 'hotel_id is required' });

            const tax = await settingsService.createTax(hotelId, req.body);
            res.status(201).json(tax);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update a tax
     */
    updateTax = async (req, res, next) => {
        try {
            const hotelId = this.getAuthorizedHotelId(req);
            if (!hotelId) return res.status(400).json({ error: 'hotel_id is required' });

            const { id } = req.params;
            const tax = await settingsService.updateTax(hotelId, id, req.body);
            res.json(tax);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete a tax
     */
    deleteTax = async (req, res, next) => {
        try {
            const hotelId = this.getAuthorizedHotelId(req);
            if (!hotelId) return res.status(400).json({ error: 'hotel_id is required' });

            const { id } = req.params;
            const result = await settingsService.deleteTax(hotelId, id);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SettingsController();
