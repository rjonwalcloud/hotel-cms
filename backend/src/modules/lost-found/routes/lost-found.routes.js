const express = require('express');
const router = express.Router();
const lostFoundController = require('../controllers/lost-found.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requireAnyRole } = require('../../../middleware/rbac.middleware');

router.use(authMiddleware);
router.use(requireAnyRole(['SUPER_ADMIN', 'HOTEL_ADMIN', 'STAFF']));

router.post('/', lostFoundController.create);
router.get('/hotel/:hotel_id', lostFoundController.getByHotel);
router.get('/:id', lostFoundController.getById);
router.put('/:id', lostFoundController.update);
router.patch('/:id/status', lostFoundController.updateStatus);
router.delete('/:id', lostFoundController.delete);

module.exports = router;
