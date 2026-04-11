const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');

// All routes require authentication
router.use(authMiddleware);

// List all tasks for a hotel (HotelAdmin or Staff with TASK_VIEW)
router.get('/hotel/:hotel_id', requirePermission('TASK_VIEW'), taskController.listByHotel);

// List tasks assigned to the current user (Staff)
router.get('/my/:hotel_id', requirePermission('TASK_VIEW'), taskController.listMyTasks);

// Get task details with history
router.get('/:id/details', requirePermission('TASK_VIEW'), taskController.getDetails);

// Get staff members for a hotel (for assignment dropdown)
router.get('/staff/:hotel_id', requirePermission('TASK_CREATE'), taskController.getStaff);

// Create a task (HotelAdmin)
router.post('/', requirePermission('TASK_CREATE'), taskController.create);

// Full update (HotelAdmin)
router.put('/:id', requirePermission('TASK_CREATE'), taskController.update);

// Update status + comments (Staff)
router.patch('/:id/status', requirePermission('TASK_UPDATE'), taskController.updateStatus);

// Delete a task (HotelAdmin)
router.delete('/:id', requirePermission('TASK_CREATE'), taskController.delete);

// Auto-task rules (HotelAdmin)
router.get('/auto-rules/:hotel_id', requirePermission('TASK_CREATE'), taskController.getAutoRules);
router.post('/auto-rules', requirePermission('TASK_CREATE'), taskController.createAutoRule);
router.put('/auto-rules/:id', requirePermission('TASK_CREATE'), taskController.updateAutoRule);
router.patch('/auto-rules/:id/toggle', requirePermission('TASK_CREATE'), taskController.toggleAutoRule);
router.delete('/auto-rules/:id', requirePermission('TASK_CREATE'), taskController.deleteAutoRule);

module.exports = router;
