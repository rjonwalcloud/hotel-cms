const db = require('../../../config/database');

class InventoryService {
    /**
     * Get dashboard statistics for today
     */
    async getDashboardStats(hotelId) {
        const client = await db.pool.connect();
        try {
            const stats = {
                totalRooms: 0,
                availableRooms: 0,
                occupiedRooms: 0,
                maintenanceRooms: 0,
                blockedRooms: 0,
                completedCheckIns: 0,
                totalCheckIns: 0,
                completedCheckOuts: 0,
                totalCheckOuts: 0
            };

            // Get live inventory capacity vs booked for TODAY
            const inventoryQuery = `
                SELECT COALESCE(SUM(total_inventory), 0) as total, COALESCE(SUM(booked_count), 0) as booked
                FROM room_inventory
                WHERE hotel_id = $1 AND inventory_date = CURRENT_DATE
            `;
            const invResult = await client.query(inventoryQuery, [hotelId]);
            stats.totalRooms = parseInt(invResult.rows[0].total) || 0;
            stats.occupiedRooms = parseInt(invResult.rows[0].booked) || 0;
            stats.availableRooms = Math.max(0, stats.totalRooms - stats.occupiedRooms);

            // Get maintenance/blocked physical rooms
            const roomStatsQuery = `
                SELECT status, COUNT(*) as count
                FROM rooms
                WHERE hotel_id = $1 AND status IN ('MAINTENANCE', 'BLOCKED')
                GROUP BY status
            `;
            const roomStatsResult = await client.query(roomStatsQuery, [hotelId]);

            roomStatsResult.rows.forEach(row => {
                const count = parseInt(row.count) || 0;
                if (row.status === 'MAINTENANCE') stats.maintenanceRooms = count;
                if (row.status === 'BLOCKED') stats.blockedRooms = count;
            });

            // Get check-ins today (completed vs total)
            const checkInsQuery = `
                SELECT
                    COUNT(*) FILTER (WHERE status IN ('CHECKED_IN', 'CHECKED_OUT')) as completed,
                    COUNT(*) FILTER (WHERE status IN ('CREATED', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')) as total
                FROM bookings
                WHERE hotel_id = $1
                AND check_in_date::date = CURRENT_DATE
            `;
            const checkInsResult = await client.query(checkInsQuery, [hotelId]);
            stats.completedCheckIns = parseInt(checkInsResult.rows[0].completed) || 0;
            stats.totalCheckIns = parseInt(checkInsResult.rows[0].total) || 0;

            // Get check-outs today (completed vs total)
            const checkOutsQuery = `
                SELECT
                    COUNT(*) FILTER (WHERE status = 'CHECKED_OUT') as completed,
                    COUNT(*) FILTER (WHERE status IN ('CHECKED_IN', 'CHECKED_OUT')) as total
                FROM bookings
                WHERE hotel_id = $1
                AND check_out_date::date = CURRENT_DATE
            `;
            const checkOutsResult = await client.query(checkOutsQuery, [hotelId]);
            stats.completedCheckOuts = parseInt(checkOutsResult.rows[0].completed) || 0;
            stats.totalCheckOuts = parseInt(checkOutsResult.rows[0].total) || 0;

            return stats;
        } finally {
            client.release();
        }
    }

    /**
     * Get monthly grid of inventory
     */
    async getInventoryCalendar(hotelId, startDate, endDate) {
        const query = `
            SELECT
                ri.inventory_date,
                rt.id as room_type_id,
                rt.name as room_type_name,
                rt.base_price,
                ri.total_inventory,
                ri.booked_count,
                (ri.total_inventory - ri.booked_count) as available_count
            FROM room_inventory ri
            JOIN room_types rt ON rt.id = ri.room_type_id
            WHERE ri.hotel_id = $1
            AND ri.inventory_date >= $2::date
            AND ri.inventory_date <= $3::date
            ORDER BY ri.inventory_date ASC, rt.name ASC
        `;

        const result = await db.query(query, [hotelId, startDate, endDate]);

        // Group by date to format for calendar grid easily
        const calendarData = {};
        const roomTypes = new Map();

        result.rows.forEach(row => {
            const dateStr = new Date(row.inventory_date).toISOString().split('T')[0];

            if (!calendarData[dateStr]) {
                calendarData[dateStr] = {};
            }

            calendarData[dateStr][row.room_type_id] = {
                name: row.room_type_name,
                total: row.total_inventory,
                booked: row.booked_count,
                available: row.available_count,
                price: row.base_price
            };

            if (!roomTypes.has(row.room_type_id)) {
                roomTypes.set(row.room_type_id, row.room_type_name);
            }
        });

        return {
            dates: calendarData,
            roomTypes: Array.from(roomTypes.entries()).map(([id, name]) => ({ id, name }))
        };
    }
}

module.exports = new InventoryService();
