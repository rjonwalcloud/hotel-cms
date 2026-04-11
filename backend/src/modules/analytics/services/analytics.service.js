const db = require('../../../config/database');

class AnalyticsService {
  /**
   * Get summary metrics for a hotel
   */
  async getSummary(hotelId, year, month) {
    try {
      const targetYear = year || new Date().getFullYear();
      const params = [hotelId];
      let dateFilter = '';
      let daysInPeriod = 30;

      // Filter by year if provided
      if (targetYear && targetYear !== 'all' && targetYear !== 'null') {
        params.push(targetYear);
        dateFilter += ` AND EXTRACT(YEAR FROM check_in_date) = $${params.length}`;
      }

      // Filter by month if provided
      if (month && month !== 'all' && month !== 'null' && month !== 'undefined') {
        params.push(month);
        dateFilter += ` AND EXTRACT(MONTH FROM check_in_date) = $${params.length}`;
        try {
          const d = new Date(parseInt(targetYear), parseInt(month), 0);
          daysInPeriod = d.getDate();
        } catch (e) {
          daysInPeriod = 30;
        }
      } else {
        daysInPeriod = 365; // Default for annual view
      }

      const summaryQuery = `
        SELECT 
          COALESCE(SUM(total_amount) FILTER (WHERE status != 'CANCELLED'), 0) as total_revenue,
          COALESCE(COUNT(id) FILTER (WHERE status != 'CANCELLED'), 0) as total_bookings,
          COALESCE(SUM(check_out_date - check_in_date) FILTER (WHERE status != 'CANCELLED'), 0) as room_nights_sold,
          (SELECT COALESCE(COUNT(id), 0) FROM rooms WHERE hotel_id = $1) as total_rooms
        FROM bookings
        WHERE hotel_id = $1 ${dateFilter}
      `;

      const summaryRes = await db.query(summaryQuery, params);
      const stats = summaryRes.rows[0] || {};

      // Deduct approved credit notes from revenue
      const refundRes = await db.query(
        'SELECT COALESCE(SUM(amount), 0) as total_refunds FROM credit_notes WHERE hotel_id = $1 AND status = \'APPROVED\'',
        [hotelId]
      );
      const totalRefunds = parseFloat(refundRes.rows[0]?.total_refunds) || 0;
      const totalRevenue = (parseFloat(stats.total_revenue) || 0) - totalRefunds;
      const totalBookings = parseInt(stats.total_bookings) || 0;
      const roomNightsSold = parseInt(stats.room_nights_sold) || 0;
      const totalRooms = parseInt(stats.total_rooms) || 0;

      return {
        totalRevenue,
        totalBookings,
        roomNightsSold,
        totalRooms,
        avgBookingValue: totalBookings > 0 ? (totalRevenue / totalBookings) : 0,
        daysInPeriod
      };
    } catch (error) {
      console.error('Service getSummary error:', error);
      throw error;
    }
  }

  /**
   * Get chart data (daily or monthly) for a hotel
   */
  async getChartData(hotelId, period, year, month) {
    try {
      const targetYear = (year && year !== 'all' && year !== 'null') ? year : new Date().getFullYear().toString();
      const queryParams = [hotelId];
      let seriesSql = '';
      let dateJoinCondition = '';
      let selectLabel = '';

      if (period === 'daily' && month && month !== 'all' && month !== 'null') {
        // Daily view for a specific month
        const paddedMonth = month.toString().padStart(2, '0');
        const startStr = `${targetYear}-${paddedMonth}-01`;
        queryParams.push(startStr);
        seriesSql = `generate_series($2::date, ($2::date + interval '1 month' - interval '1 day')::date, '1 day')`;
        dateJoinCondition = `b.check_in_date = ds.d`;
        selectLabel = `TO_CHAR(ds.d, 'DD Mon')`; // e.g. 01 Mar
      } else {
        // Monthly view for the year
        const startStr = `${targetYear}-01-01`;
        queryParams.push(startStr);
        seriesSql = `generate_series($2::date, ($2::date + interval '11 months')::date, '1 month')`;
        dateJoinCondition = `EXTRACT(MONTH FROM b.check_in_date) = EXTRACT(MONTH FROM ds.d) AND EXTRACT(YEAR FROM b.check_in_date) = EXTRACT(YEAR FROM ds.d)`;
        selectLabel = `TO_CHAR(ds.d, 'Mon')`; // e.g. Jan, Feb
      }

      const query = `
        SELECT 
          ${selectLabel} as label,
          COALESCE(SUM(b.total_amount) FILTER (WHERE b.status != 'CANCELLED'), 0) as revenue,
          COALESCE(COUNT(b.id) FILTER (WHERE b.status != 'CANCELLED'), 0) as bookings,
          COALESCE(COUNT(b.id) FILTER (WHERE b.status = 'CANCELLED'), 0) as cancellations
        FROM (SELECT ${seriesSql} as d) ds
        LEFT JOIN bookings b ON 
          b.hotel_id = $1 AND ${dateJoinCondition}
        GROUP BY ds.d
        ORDER BY ds.d ASC
      `;

      const res = await db.query(query, queryParams);
      return res.rows.map(row => ({
        label: row.label,
        revenue: parseFloat(row.revenue) || 0,
        bookings: parseInt(row.bookings) || 0,
        cancellations: parseInt(row.cancellations) || 0
      }));
    } catch (error) {
      console.error('Service getChartData error:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
