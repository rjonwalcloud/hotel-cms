const db = require('../../../config/database');

class RateService {
    // =================== RATE PLANS ===================

    async getRatePlans(hotelId) {
        const result = await db.query(
            `SELECT rp.*, 
              (SELECT COUNT(*) FROM rate_rules rr WHERE rr.rate_plan_id = rp.id) as rules_count
             FROM rate_plans rp
             WHERE rp.hotel_id = $1
             ORDER BY rp.priority DESC, rp.created_at DESC`,
            [hotelId]
        );
        return result.rows;
    }

    async createRatePlan(data, hotelId) {
        const { name, description, is_default, is_active, priority } = data;

        // If setting as default, unset other defaults
        if (is_default) {
            await db.query('UPDATE rate_plans SET is_default = false WHERE hotel_id = $1', [hotelId]);
        }

        const result = await db.query(
            `INSERT INTO rate_plans (hotel_id, name, description, is_default, is_active, priority)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [hotelId, name, description, is_default || false, is_active !== false, priority || 0]
        );
        return result.rows[0];
    }

    async updateRatePlan(id, data, hotelId) {
        const { name, description, is_default, is_active, priority } = data;

        if (is_default) {
            await db.query('UPDATE rate_plans SET is_default = false WHERE hotel_id = $1 AND id != $2', [hotelId, id]);
        }

        const result = await db.query(
            `UPDATE rate_plans SET name = $1, description = $2, is_default = $3, is_active = $4, 
             priority = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6 AND hotel_id = $7 RETURNING *`,
            [name, description, is_default || false, is_active !== false, priority || 0, id, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Rate plan not found');
        return result.rows[0];
    }

    async deleteRatePlan(id, hotelId) {
        const result = await db.query(
            'DELETE FROM rate_plans WHERE id = $1 AND hotel_id = $2 RETURNING id',
            [id, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Rate plan not found');
        return { deleted: true };
    }

    // =================== RATE RULES ===================

    async getRateRules(hotelId, filters = {}) {
        let query = `
            SELECT rr.*, 
              rp.name as rate_plan_name,
              rp.is_active as plan_is_active,
              rt.name as room_type_name
            FROM rate_rules rr
            LEFT JOIN rate_plans rp ON rr.rate_plan_id = rp.id
            LEFT JOIN room_types rt ON rr.room_type_id = rt.id
            WHERE rr.hotel_id = $1
        `;
        const params = [hotelId];
        let paramCount = 2;

        if (filters.rate_plan_id) {
            query += ` AND rr.rate_plan_id = $${paramCount}`;
            params.push(filters.rate_plan_id);
            paramCount++;
        }
        if (filters.room_type_id) {
            query += ` AND rr.room_type_id = $${paramCount}`;
            params.push(filters.room_type_id);
            paramCount++;
        }
        if (filters.active_only) {
            query += ` AND rr.is_active = true`;
        }

        query += ` ORDER BY rr.start_date ASC, rr.created_at DESC`;

        const result = await db.query(query, params);
        return result.rows;
    }

    async createRateRule(data, hotelId) {
        const {
            rate_plan_id, room_type_id, name, start_date, end_date,
            price_override, adjustment_type, adjustment_value,
            day_of_week, min_nights, is_active
        } = data;

        const result = await db.query(
            `INSERT INTO rate_rules (hotel_id, rate_plan_id, room_type_id, name, start_date, end_date,
             price_override, adjustment_type, adjustment_value, day_of_week, min_nights, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [hotelId, rate_plan_id, room_type_id, name, start_date, end_date,
                price_override, adjustment_type || 'FIXED', adjustment_value,
                day_of_week || null, min_nights || 1, is_active !== false]
        );
        return result.rows[0];
    }

    async updateRateRule(id, data, hotelId) {
        const {
            rate_plan_id, room_type_id, name, start_date, end_date,
            price_override, adjustment_type, adjustment_value,
            day_of_week, min_nights, is_active
        } = data;

        const result = await db.query(
            `UPDATE rate_rules SET rate_plan_id = $1, room_type_id = $2, name = $3,
             start_date = $4, end_date = $5, price_override = $6,
             adjustment_type = $7, adjustment_value = $8, day_of_week = $9,
             min_nights = $10, is_active = $11, updated_at = CURRENT_TIMESTAMP
             WHERE id = $12 AND hotel_id = $13 RETURNING *`,
            [rate_plan_id, room_type_id, name, start_date, end_date,
                price_override, adjustment_type || 'FIXED', adjustment_value,
                day_of_week || null, min_nights || 1, is_active !== false, id, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Rate rule not found');
        return result.rows[0];
    }

    async deleteRateRule(id, hotelId) {
        const result = await db.query(
            'DELETE FROM rate_rules WHERE id = $1 AND hotel_id = $2 RETURNING id',
            [id, hotelId]
        );
        if (result.rows.length === 0) throw new Error('Rate rule not found');
        return { deleted: true };
    }

    /**
     * Find the best applicable rate for a room type on a given date range.
     * Priority: rate_rules with highest priority plan > default plan > base_price fallback
     */
    async getEffectiveRate(roomTypeId, hotelId, checkIn, checkOut) {
        const result = await db.query(
            `SELECT rr.price_override, rr.adjustment_type, rr.adjustment_value, rr.name as rule_name,
                    rp.name as plan_name, rp.priority
             FROM rate_rules rr
             JOIN rate_plans rp ON rr.rate_plan_id = rp.id
             WHERE rr.hotel_id = $1
               AND rr.room_type_id = $2
               AND rr.is_active = true
               AND rp.is_active = true
               AND rr.start_date <= $3::date
               AND rr.end_date >= $4::date
             ORDER BY rp.priority DESC, rr.created_at DESC
             LIMIT 1`,
            [hotelId, roomTypeId, checkIn, checkOut]
        );

        if (result.rows.length > 0) {
            return {
                price: parseFloat(result.rows[0].price_override),
                source: 'rate_rule',
                rule_name: result.rows[0].rule_name,
                plan_name: result.rows[0].plan_name
            };
        }

        // Fallback to base_price
        const baseResult = await db.query(
            'SELECT base_price FROM room_types WHERE id = $1',
            [roomTypeId]
        );
        return {
            price: baseResult.rows.length > 0 ? parseFloat(baseResult.rows[0].base_price) : 0,
            source: 'base_price',
            rule_name: null,
            plan_name: null
        };
    }
}

module.exports = new RateService();
