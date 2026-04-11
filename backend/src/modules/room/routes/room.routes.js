const express = require('express');
const router = express.Router();
const roomController = require('../controllers/room.controller');
const roomTypeController = require('../controllers/room-type.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');
const { checkQuota } = require('../../../middleware/quota.middleware');
const { requireActiveSubscription } = require('../../../middleware/subscription.middleware');

// --- Room Type Routes ---

router.get(
  '/types/hotel/:hotel_id',
  authMiddleware,
  requirePermission('ROOM_VIEW'),
  roomTypeController.getRoomTypes
);

router.post(
  '/types/hotel/:hotel_id/sync-inventory',
  authMiddleware,
  requirePermission('ROOM_CREATE'),
  requireActiveSubscription,
  roomTypeController.syncInventory
);

router.post(
  '/types',
  authMiddleware,
  requirePermission('ROOM_CREATE'),
  requireActiveSubscription,
  roomTypeController.createRoomType
);

router.put(
  '/types/:id',
  authMiddleware,
  requirePermission('ROOM_UPDATE'),
  requireActiveSubscription,
  roomTypeController.updateRoomType
);

router.delete(
  '/types/:id',
  authMiddleware,
  requirePermission('ROOM_DELETE'),
  requireActiveSubscription,
  roomTypeController.deleteRoomType
);

// --- Room Routes ---

// Create room (Hotel Admin only, with quota check)
router.post(
  '/',
  authMiddleware,
  requirePermission('ROOM_CREATE'),
  requireActiveSubscription,
  checkQuota('room_create'),
  roomController.createRoom
);

// Get rooms for hotel (Anyone with ROOM_VIEW)
router.get(
  '/hotel/:hotel_id',
  authMiddleware,
  requirePermission('ROOM_VIEW'),
  roomController.getRoomsByHotel
);

// Get single room
router.get(
  '/:room_id',
  authMiddleware,
  requirePermission('ROOM_VIEW'),
  roomController.getRoomById
);

// Update room status (Staff can do this)
router.patch(
  '/:room_id/status',
  authMiddleware,
  requirePermission('ROOM_UPDATE_STATUS'),
  roomController.updateRoomStatus
);

// Update room details (Hotel Admin only)
router.put(
  '/:room_id',
  authMiddleware,
  requirePermission('ROOM_UPDATE'),
  requireActiveSubscription,
  roomController.updateRoom
);

// Delete room (Hotel Admin only)
router.delete(
  '/:room_id',
  authMiddleware,
  requirePermission('ROOM_DELETE'),
  requireActiveSubscription,
  roomController.deleteRoom
);

module.exports = router;
