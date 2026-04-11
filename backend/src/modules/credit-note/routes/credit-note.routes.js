const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/credit-note.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requireAnyRole } = require('../../../middleware/rbac.middleware');

router.use(authMiddleware);
router.use(requireAnyRole(['SUPER_ADMIN', 'HOTEL_ADMIN']));

router.post('/', creditNoteController.create);
router.get('/hotel/:hotel_id', creditNoteController.getByHotel);
router.get('/:id', creditNoteController.getById);
router.patch('/:id/approve', creditNoteController.approve);
router.patch('/:id/reject', creditNoteController.reject);

module.exports = router;
