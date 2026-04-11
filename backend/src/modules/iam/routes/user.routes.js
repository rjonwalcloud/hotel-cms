const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const menuController = require('../controllers/menu.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requireRole } = require('../../../middleware/rbac.middleware');

// All routes here are restricted to SUPER_ADMIN for now as per requirement
router.use(authMiddleware);
router.use(requireRole('SUPER_ADMIN'));

router.get('/permissions', userController.listPermissions);
router.get('/hotel/:hotel_id', userController.listUsers);
router.post('/menu-visibility', menuController.updateVisibility);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.delete('/:id', userController.delete);

module.exports = router;
