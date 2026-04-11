const express = require('express');
const router = express.Router();
const systemController = require('../controllers/system.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requireRole } = require('../../../middleware/rbac.middleware');

// Download full database backup (Super Admin only)
router.get(
    '/backup',
    authMiddleware,
    requireRole('SUPER_ADMIN'),
    systemController.downloadBackup
);

// Get all system configurations (Super Admin only)
router.get(
    '/configs',
    authMiddleware,
    requireRole('SUPER_ADMIN'),
    systemController.getConfigs
);

// Update system configurations (Super Admin only)
router.post(
    '/configs',
    authMiddleware,
    requireRole('SUPER_ADMIN'),
    systemController.updateConfigs
);

module.exports = router;
