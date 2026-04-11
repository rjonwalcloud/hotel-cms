/**
 * RBAC Middleware - Role-Based Access Control
 * Checks if user has required permissions or roles
 */

/**
 * Check if user has a specific permission
 * @param {string} permission - Permission key (e.g., 'ROOM_CREATE')
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'User not authenticated' 
      });
    }

    // Extract all permissions from all roles
    const userPermissions = req.user.roles
      .flatMap(role => role.permissions || [])
      .filter(Boolean);

    // Check if user has the required permission
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `Permission '${permission}' required`,
        required: permission,
        available: userPermissions
      });
    }

    next();
  };
};

/**
 * Check if user has a specific role
 * @param {string} roleName - Role name (e.g., 'SUPER_ADMIN')
 */
const requireRole = (roleName) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'User not authenticated' 
      });
    }

    const hasRole = req.user.roles.some(role => role.role === roleName);

    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `Role '${roleName}' required` 
      });
    }

    next();
  };
};

/**
 * Check if user has any of the specified roles
 * @param {string[]} roleNames - Array of role names
 */
const requireAnyRole = (roleNames) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'User not authenticated' 
      });
    }

    const hasAnyRole = req.user.roles.some(role => roleNames.includes(role.role));

    if (!hasAnyRole) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `One of the following roles required: ${roleNames.join(', ')}` 
      });
    }

    next();
  };
};

/**
 * Check if user has ANY of the specified permissions
 * @param {string[]} permissions - Array of permission keys
 */
const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'User not authenticated' 
      });
    }

    const userPermissions = req.user.roles
      .flatMap(role => role.permissions || [])
      .filter(Boolean);

    const hasAnyPermission = permissions.some(p => userPermissions.includes(p));

    if (!hasAnyPermission) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'At least one of the required permissions needed',
        required: permissions,
        available: userPermissions
      });
    }

    next();
  };
};

/**
 * Check if user has ALL of the specified permissions
 * @param {string[]} permissions - Array of permission keys
 */
const requireAllPermissions = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'User not authenticated' 
      });
    }

    const userPermissions = req.user.roles
      .flatMap(role => role.permissions || [])
      .filter(Boolean);

    const hasAllPermissions = permissions.every(p => userPermissions.includes(p));

    if (!hasAllPermissions) {
      const missing = permissions.filter(p => !userPermissions.includes(p));
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'All required permissions needed',
        required: permissions,
        missing: missing,
        available: userPermissions
      });
    }

    next();
  };
};

/**
 * Helper to check if user is Super Admin
 */
const isSuperAdmin = (req) => {
  return req.user?.roles?.some(role => role.role === 'SUPER_ADMIN');
};

/**
 * Helper to check if user is Hotel Admin for a specific hotel
 */
const isHotelAdmin = (req, hotelId) => {
  return req.user?.roles?.some(
    role => role.role === 'HOTEL_ADMIN' && role.hotel_id === hotelId
  );
};

module.exports = {
  requirePermission,
  requireRole,
  requireAnyRole,
  requireAnyPermission,
  requireAllPermissions,
  isSuperAdmin,
  isHotelAdmin
};
