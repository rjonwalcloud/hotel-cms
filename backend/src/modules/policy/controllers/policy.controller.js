const policyService = require('../services/policy.service');

class PolicyController {
  /**
   * GET /api/policy/limits
   * Get all policy limits
   */
  async getAllPolicyLimits(req, res, next) {
    try {
      const limits = await policyService.getAllPolicyLimits();

      res.json({
        success: true,
        count: limits.length,
        limits
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/policy/hotel/:hotel_id/limits
   * Get limits for a specific hotel
   */
  async getHotelLimits(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const limits = await policyService.getHotelLimits(hotel_id);

      res.json({
        success: true,
        hotel_id,
        count: limits.length,
        limits
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/policy/hotel/:hotel_id/limits
   * Set hotel limit (Super Admin only)
   */
  async setHotelLimit(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const { limit_key, max_value } = req.body;

      if (!limit_key || max_value === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'limit_key and max_value are required'
        });
      }

      if (max_value < 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'max_value must be non-negative'
        });
      }

      const limit = await policyService.setHotelLimit(
        hotel_id,
        limit_key,
        max_value,
        req.user.id
      );

      res.json({
        success: true,
        message: 'Hotel limit updated successfully',
        limit
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
   * GET /api/policy/hotel/:hotel_id/usage
   * Get usage statistics for hotel
   */
  async getUsageStats(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const stats = await policyService.getUsageStats(hotel_id);

      res.json({
        success: true,
        hotel_id,
        stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/policy/hotel/:hotel_id/reset-counter
   * Reset usage counter (Super Admin only)
   */
  async resetUsageCounter(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const { limit_key } = req.body;

      if (!limit_key) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'limit_key is required'
        });
      }

      const result = await policyService.resetUsageCounter(
        hotel_id,
        limit_key,
        req.user.id
      );

      res.json({
        success: true,
        message: 'Usage counter reset successfully',
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/policy/quota-summary
   * Get quota summary for all hotels (Super Admin only)
   */
  async getQuotaSummaryAllHotels(req, res, next) {
    try {
      const summary = await policyService.getQuotaSummaryAllHotels();

      res.json({
        success: true,
        count: summary.length,
        hotels: summary
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PolicyController();
