const taskService = require('../services/task.service');

class TaskController {
    /**
     * List all tasks for a hotel
     */
    listByHotel = async (req, res) => {
        try {
            const { hotel_id } = req.params;
            const tasks = await taskService.listByHotel(hotel_id);
            res.json({ success: true, tasks });
        } catch (error) {
            console.error('listByHotel error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    /**
     * List tasks assigned to the current user
     */
    listMyTasks = async (req, res) => {
        try {
            const { hotel_id } = req.params;
            const userId = req.user.id;
            const tasks = await taskService.listByUser(userId, hotel_id);
            res.json({ success: true, tasks });
        } catch (error) {
            console.error('listMyTasks error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    /**
     * Get staff members for assignment dropdown
     */
    getStaff = async (req, res) => {
        try {
            const { hotel_id } = req.params;
            const staff = await taskService.getStaffByHotel(hotel_id);
            res.json({ success: true, staff });
        } catch (error) {
            console.error('getStaff error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    /**
     * Get task details with history
     */
    getDetails = async (req, res) => {
        try {
            const { id } = req.params;
            const task = await taskService.getById(id);
            if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
            const history = await taskService.getHistory(id);
            res.json({ success: true, task, history });
        } catch (error) {
            console.error('getDetails error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    };

    /**
     * Create a task
     */
    create = async (req, res) => {
        try {
            const task = await taskService.create({
                ...req.body,
                created_by: req.user.id
            });
            res.status(201).json({ success: true, message: 'Task created successfully', task });
        } catch (error) {
            console.error('createTask error:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    };

    /**
     * Full update (HotelAdmin)
     */
    update = async (req, res) => {
        try {
            const { id } = req.params;
            const task = await taskService.update(id, req.body, req.user.id);
            res.json({ success: true, message: 'Task updated successfully', task });
        } catch (error) {
            console.error('updateTask error:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    };

    /**
     * Update status + comments (Staff)
     */
    updateStatus = async (req, res) => {
        try {
            const { id } = req.params;
            const { status, comments } = req.body;
            const task = await taskService.updateStatus(id, status, comments, req.user.id);
            res.json({ success: true, message: 'Task status updated', task });
        } catch (error) {
            console.error('updateTaskStatus error:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    };

    /**
     * Delete a task
     */
    delete = async (req, res) => {
        try {
            const { id } = req.params;
            await taskService.delete(id);
            res.json({ success: true, message: 'Task deleted successfully' });
        } catch (error) {
            console.error('deleteTask error:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    };
    // ============================================
    // AUTO-TASK RULES
    // ============================================

    getAutoRules = async (req, res) => {
        try {
            const { hotel_id } = req.params;
            const rules = await taskService.getAutoRules(hotel_id);
            res.json({ success: true, rules });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    createAutoRule = async (req, res) => {
        try {
            const rule = await taskService.createAutoRule(req.body);
            res.status(201).json({ success: true, rule });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    };

    updateAutoRule = async (req, res) => {
        try {
            const rule = await taskService.updateAutoRule(req.params.id, req.body);
            res.json({ success: true, rule });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    };

    toggleAutoRule = async (req, res) => {
        try {
            const rule = await taskService.toggleAutoRule(req.params.id);
            res.json({ success: true, rule });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    };

    deleteAutoRule = async (req, res) => {
        try {
            await taskService.deleteAutoRule(req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    };
}

module.exports = new TaskController();
