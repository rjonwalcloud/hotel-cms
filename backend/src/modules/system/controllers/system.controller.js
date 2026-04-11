const systemService = require('../services/system.service');

class SystemController {
    /**
     * GET /api/system/backup
     * Downloads a full SQL backup of the database
     */
    async downloadBackup(req, res, next) {
        try {
            const sqlDump = await systemService.generateBackupDump();

            const filename = `hotel_cms_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.sql`;

            res.setHeader('Content-Type', 'text/plain'); // Plain text for SQL
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            res.send(sqlDump);
        } catch (error) {
            console.error('Backup failed:', error);
            next(error);
        }
    }

    /**
     * GET /api/system/configs
     * Fetches all system configurations
     */
    async getConfigs(req, res, next) {
        try {
            const configs = await systemService.getConfigs();
            res.json({
                success: true,
                data: configs
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/system/configs
     * Updates system configurations
     */
    async updateConfigs(req, res, next) {
        try {
            const result = await systemService.updateConfigs(req.body);
            res.json({
                success: true,
                message: 'System configurations updated successfully',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SystemController();
