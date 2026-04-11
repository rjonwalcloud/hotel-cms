/**
 * Subscription Middleware
 * Enforces active subscription requirements for hotel operations
 */

const db = require('../config/database');
const { isSuperAdmin } = require('./rbac.middleware');

/**
 * Check if the hotel has an active subscription
 */
const requireActiveSubscription = async (req, res, next) => {
    try {
        // Super Admins bypass subscription checks
        if (isSuperAdmin(req)) {
            return next();
        }

        // Determine hotel_id from request
        const hotelId = req.body.hotel_id ||
            req.params.hotel_id ||
            req.user.hotel_id;

        if (!hotelId) {
            // If we can't determine the hotel, we can't enforce subscription
            // But for routes that require it, this might be a Bad Request
            // For now, let's proceed and let other validators handle missing IDs if needed
            // OR better: if this middleware is used, hotel_id SHOULD be present.
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Hotel ID required for subscription check'
            });
        }

        // Check for active subscription
        const query = `
      SELECT * FROM hotel_subscriptions 
      WHERE hotel_id = $1 
      AND status = 'ACTIVE' 
      AND end_date > CURRENT_TIMESTAMP
    `;

        const result = await db.query(query, [hotelId]);

        if (result.rows.length === 0) {
            return res.status(403).json({
                error: 'Subscription Required',
                message: 'Active subscription required for this operation',
                code: 'SUBSCRIPTION_EXPIRED'
            });
        }

        // Attach subscription info to request
        req.subscription = result.rows[0];
        next();
    } catch (error) {
        console.error('Subscription check error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to verify subscription status'
        });
    }
};

module.exports = {
    requireActiveSubscription
};
