const auditService = require('../services/audit.service');

class AuditController {
  /**
   * GET /api/audit/hotel/:hotel_id
   * Get audit logs for hotel
   */
  async getAuditLogsByHotel(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const filters = {
        user_id: req.query.user_id,
        action: req.query.action,
        entity_type: req.query.entity_type,
        entity_id: req.query.entity_id,
        from_date: req.query.from_date,
        to_date: req.query.to_date,
        limit: req.query.limit ? parseInt(req.query.limit) : 100,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const logs = await auditService.getAuditLogsByHotel(hotel_id, filters);

      res.json({
        success: true,
        hotel_id,
        count: logs.length,
        filters,
        logs
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/log/:log_id
   * Get audit log by ID
   */
  async getAuditLogById(req, res, next) {
    try {
      const { log_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;

      if (!hotelId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Hotel ID is required'
        });
      }

      const log = await auditService.getAuditLogById(log_id, hotelId);

      res.json({
        success: true,
        log
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/audit/entity/:entity_type/:entity_id
   * Get audit history for specific entity
   */
  async getEntityHistory(req, res, next) {
    try {
      const { entity_type, entity_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;

      if (!hotelId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Hotel ID is required'
        });
      }

      const history = await auditService.getEntityHistory(
        entity_type,
        entity_id,
        hotelId
      );

      res.json({
        success: true,
        entity_type,
        entity_id,
        count: history.length,
        history
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/hotel/:hotel_id/stats
   * Get audit statistics
   */
  async getAuditStats(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const fromDate = req.query.from_date;
      const toDate = req.query.to_date;

      const stats = await auditService.getAuditStats(hotel_id, fromDate, toDate);

      res.json({
        success: true,
        hotel_id,
        period: { from: fromDate, to: toDate },
        stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/user/:user_id/activity
   * Get user activity logs
   */
  async getUserActivity(req, res, next) {
    try {
      const { user_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;

      if (!hotelId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Hotel ID is required'
        });
      }

      const activity = await auditService.getUserActivity(user_id, hotelId, limit);

      res.json({
        success: true,
        user_id,
        count: activity.length,
        activity
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/all
   * Get all audit logs (Super Admin only)
   */
  async getAllAuditLogs(req, res, next) {
    try {
      const filters = {
        hotel_id: req.query.hotel_id,
        user_id: req.query.user_id,
        action: req.query.action,
        from_date: req.query.from_date,
        to_date: req.query.to_date,
        limit: req.query.limit ? parseInt(req.query.limit) : 100,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const logs = await auditService.getAllAuditLogs(filters);

      res.json({
        success: true,
        count: logs.length,
        filters,
        logs
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/hotel/:hotel_id/export
   * Export audit logs
   */
  async exportAuditLogs(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const fromDate = req.query.from_date;
      const toDate = req.query.to_date;

      if (!fromDate || !toDate) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'from_date and to_date are required'
        });
      }

      const logs = await auditService.exportAuditLogs(hotel_id, fromDate, toDate);

      // Convert to CSV
      const csvHeader = 'Timestamp,User Name,User Email,Action,Entity Type,Entity ID,IP Address\n';
      const csvRows = logs.map(log => {
        return `${log.created_at},${log.user_name || 'System'},${log.user_email || 'N/A'},${log.action},${log.entity_type},${log.entity_id || 'N/A'},${log.ip_address || 'N/A'}`;
      }).join('\n');

      const csv = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${hotel_id}-${fromDate}-to-${toDate}.csv`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit/export/all
   * Export all audit logs (Super Admin)
   */
  async exportAllAuditLogs(req, res, next) {
    try {
      const filters = {
        action: req.query.action,
        entity_type: req.query.entity_type,
        from_date: req.query.from_date,
        to_date: req.query.to_date
      };

      const logs = await auditService.exportAllAuditLogs(filters);

      // Convert to CSV
      const csvHeader = 'Timestamp,Hotel,User Name,User Email,Action,Entity Type,Entity ID,IP Address\n';
      const csvRows = logs.map(log => {
        // Escape fields that might contain commas
        const hotelName = log.hotel_name ? `"${log.hotel_name}"` : 'N/A';
        const userName = log.user_name ? `"${log.user_name}"` : 'System';

        return `${log.created_at},${hotelName},${userName},${log.user_email || 'N/A'},${log.action},${log.entity_type},${log.entity_id || 'N/A'},${log.ip_address || 'N/A'}`;
      }).join('\n');

      const csv = csvHeader + csvRows;

      const dateStr = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=global-audit-logs-${dateStr}.csv`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuditController();
