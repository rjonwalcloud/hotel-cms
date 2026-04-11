const analyticsService = require('../services/analytics.service');

class AnalyticsController {
  async getSummary(req, res) {
    try {
      const { hotelId } = req.params;
      const { year, month } = req.query;
      
      const summary = await analyticsService.getSummary(hotelId, year, month);
      res.json(summary);
    } catch (error) {
      console.error('Analytics summary error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
  }

  async getChartData(req, res) {
    try {
      const { hotelId } = req.params;
      const { period, year, month } = req.query; // period: daily, weekly, monthly
      
      const chartData = await analyticsService.getChartData(hotelId, period, year, month);
      res.json(chartData);
    } catch (error) {
      console.error('Analytics chart error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics chart data' });
    }
  }
}

module.exports = new AnalyticsController();
