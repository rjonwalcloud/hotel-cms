/**
 * Quota Middleware - Enforces usage limits
 * Checks if action would exceed hotel's quota before allowing it
 */

const db = require('../config/database');
const { isSuperAdmin } = require('./rbac.middleware');

/**
 * Check if quota allows the action
 * @param {string} limitKey - Policy limit key (e.g., 'room_create')
 */
const checkQuota = (limitKey) => {
  return async (req, res, next) => {
    try {
      // Super Admins bypass quota checks
      if (isSuperAdmin(req)) {
        return next();
      }

      // Determine hotel_id from request
      const hotelId = req.body.hotel_id || 
                      req.params.hotel_id || 
                      req.user.hotel_id;

      if (!hotelId) {
        return res.status(400).json({ 
          error: 'Bad Request',
          message: 'Hotel ID required for quota check' 
        });
      }

      // Query quota status
      const quotaQuery = `
        SELECT 
          pl.key,
          pl.description,
          hl.max_value,
          COALESCE(uc.current_value, 0) as current_value,
          hl.max_value - COALESCE(uc.current_value, 0) as remaining
        FROM hotel_limits hl
        JOIN policy_limits pl ON pl.id = hl.policy_limit_id
        LEFT JOIN usage_counters uc ON uc.hotel_id = hl.hotel_id 
          AND uc.policy_limit_id = hl.policy_limit_id
        WHERE hl.hotel_id = $1 AND pl.key = $2
      `;

      const result = await db.query(quotaQuery, [hotelId, limitKey]);

      // If no limit is configured, check default policy
      if (result.rows.length === 0) {
        const defaultQuery = `
          SELECT default_max_value 
          FROM policy_limits 
          WHERE key = $1
        `;
        const defaultResult = await db.query(defaultQuery, [limitKey]);
        
        if (defaultResult.rows.length === 0) {
          // No policy exists - allow (or you could deny by default)
          return next();
        }

        // Use default max value
        const defaultMax = defaultResult.rows[0].default_max_value;
        
        // Check current usage against default
        const usageQuery = `
          SELECT COALESCE(current_value, 0) as current_value
          FROM usage_counters uc
          JOIN policy_limits pl ON pl.id = uc.policy_limit_id
          WHERE uc.hotel_id = $1 AND pl.key = $2
        `;
        const usageResult = await db.query(usageQuery, [hotelId, limitKey]);
        const currentUsage = usageResult.rows[0]?.current_value || 0;

        if (currentUsage >= defaultMax) {
          return res.status(403).json({
            error: 'Quota Exceeded',
            message: `Limit for '${limitKey}' reached`,
            quota: {
              limit: limitKey,
              current: currentUsage,
              max: defaultMax,
              remaining: 0
            }
          });
        }

        req.quota = { hotelId, limitKey };
        return next();
      }

      // Check if limit is exceeded
      const quota = result.rows[0];

      if (quota.current_value >= quota.max_value) {
        return res.status(403).json({ 
          error: 'Quota Exceeded',
          message: `Limit for '${quota.description}' reached`,
          quota: {
            limit: limitKey,
            description: quota.description,
            current: quota.current_value,
            max: quota.max_value,
            remaining: 0
          },
          help: 'Contact your administrator to increase limits'
        });
      }

      // Attach quota info for service layer to increment
      req.quota = {
        hotelId,
        limitKey,
        current: quota.current_value,
        max: quota.max_value,
        remaining: quota.remaining
      };

      next();
    } catch (error) {
      console.error('Quota check error:', error);
      // Fail open or fail closed? Let's fail closed for security
      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Quota check failed' 
      });
    }
  };
};

/**
 * Warn if quota is near limit (optional middleware)
 * Adds warning header if usage > 80%
 */
const warnQuotaNearLimit = (threshold = 0.8) => {
  return (req, res, next) => {
    if (req.quota) {
      const usagePercent = req.quota.current / req.quota.max;
      
      if (usagePercent >= threshold) {
        res.setHeader('X-Quota-Warning', 
          `Usage at ${Math.round(usagePercent * 100)}% for ${req.quota.limitKey}`
        );
      }
    }
    next();
  };
};

module.exports = {
  checkQuota,
  warnQuotaNearLimit
};
