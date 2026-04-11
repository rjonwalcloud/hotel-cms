const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user with roles and permissions
    const userQuery = `
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.is_active,
        json_agg(
          DISTINCT jsonb_build_object(
            'role', r.name,
            'hotel_id', ur.hotel_id,
            'permissions', COALESCE(
              ur.custom_permissions,
              (
                SELECT json_agg(p.key)::jsonb
                FROM role_permissions rp
                JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = r.id
              )
            )
          )
        ) as roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1 AND u.is_active = true
      GROUP BY u.id, u.email, u.full_name, u.is_active
    `;

    const result = await db.query(userQuery, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found or inactive'
      });
    }

    // Attach user to request
    req.user = result.rows[0];

    // Extract hotel context if available
    const hotelRole = req.user.roles.find(r => r.hotel_id);
    if (hotelRole) {
      req.user.hotel_id = hotelRole.hotel_id;
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

module.exports = authMiddleware;
