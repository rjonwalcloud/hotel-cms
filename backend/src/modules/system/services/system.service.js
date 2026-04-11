const db = require('../../../config/database');

class SystemService {
    /**
     * Generates a full SQL dump of the database
     */
    async generateBackupDump() {
        const tables = [
            'permissions',
            'roles',
            'users',
            'hotels',
            'role_permissions',
            'user_roles',
            'subscription_plans',
            'hotel_subscriptions',
            'policy_limits',
            'hotel_limits',
            'usage_counters',
            'room_types',
            'rooms',
            'service_categories',
            'service_items',
            'amenities',
            'room_inventory',
            'rate_plans',
            'rate_rules',
            'promotions',
            'coupon_codes',
            'hotel_settings',
            'taxes',
            'bulk_bookings',
            'bookings',
            'booking_guests',
            'booking_rooms',
            'booking_events',
            'booking_status_history',
            'booking_taxes',
            'promo_usage',
            'tasks',
            'task_history',
            'booking_channels',
            'channel_bookings',
            'room_qr_codes',
            'service_requests',
            'sr_history',
            'addons',
            'booking_addons',
            'audit_logs',
            'system_configs'
        ];

        let sqlDump = `-- Hotel CMS - Complete Database Backup\n`;
        sqlDump += `-- Generated at: ${new Date().toISOString()}\n\n`;
        sqlDump += `BEGIN;\n\n`;
        sqlDump += `-- Disable triggers to avoid foreign key checks during data insertion\n`;
        sqlDump += `SET session_replication_role = 'replica';\n\n`;

        // Clear existing data to avoid PK violations
        sqlDump += `-- Clear existing data\n`;
        for (const table of [...tables].reverse()) {
            sqlDump += `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;\n`;
        }
        sqlDump += `\n`;

        for (const table of tables) {
            const result = await db.query(`SELECT * FROM ${table}`);
            const rows = result.rows;

            if (rows.length === 0) continue;

            sqlDump += `-- Data for table: ${table}\n`;
            const columns = Object.keys(rows[0]);

            for (const row of rows) {
                const values = columns.map(col => {
                    const val = row[col];
                    if (val === null) return 'NULL';
                    if (typeof val === 'boolean') return val;
                    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                    if (val instanceof Date) return `'${val.toISOString()}'`;
                    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
                    return val;
                });

                sqlDump += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            }
            sqlDump += `\n`;
        }

        sqlDump += `-- Re-enable triggers\n`;
        sqlDump += `SET session_replication_role = 'origin';\n\n`;
        sqlDump += `COMMIT;\n`;

        return sqlDump;
    }

    /**
     * Get all system configurations
     */
    async getConfigs() {
        const result = await db.query('SELECT config_key, config_value, description FROM system_configs ORDER BY config_key ASC');
        return result.rows;
    }

    /**
     * Update system configurations
     * @param {Object} configs - Object with config_key as key and config_value as value
     */
    async updateConfigs(configs) {
        const keys = Object.keys(configs);
        for (const key of keys) {
            await db.query(
                `INSERT INTO system_configs (config_key, config_value, updated_at)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (config_key) DO UPDATE SET
                 config_value = EXCLUDED.config_value,
                 updated_at = CURRENT_TIMESTAMP`,
                [key, configs[key]]
            );
        }
        return { success: true };
    }
}

module.exports = new SystemService();
