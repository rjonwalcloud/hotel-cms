const db = require('../../../config/database');

class SettingsService {
    /**
     * Get hotel settings (currency, etc)
     */
    async getSettings(hotelId) {
        let query = `
            SELECT hs.*, h.hotel_id_code 
            FROM hotel_settings hs
            JOIN hotels h ON h.id = hs.hotel_id
            WHERE hs.hotel_id = $1
        `;
        let result = await db.query(query, [hotelId]);

        if (result.rows.length === 0) {
            // Create default settings if none exist
            const insertQuery = `
                INSERT INTO hotel_settings (hotel_id, currency_code, currency_symbol, task_automation_enabled, invoice_counter)
                VALUES ($1, 'USD', '$', true, 0)
                RETURNING *
            `;
            await db.query(insertQuery, [hotelId]);

            // Re-fetch with join to get hotel_id_code
            result = await db.query(query, [hotelId]);
        }
        return result.rows[0];
    }

    /**
     * Update hotel settings
     */
    async updateSettings(hotelId, settingsData, userId) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const {
                currency_code,
                currency_symbol,
                task_automation_enabled,
                upi_id,
                bank_name,
                account_number,
                ifsc_code,
                upi_qr_code,
                support_phone,
                support_email,
                support_whatsapp
            } = settingsData;

            const updateQuery = `
        INSERT INTO hotel_settings (
          hotel_id, currency_code, currency_symbol, task_automation_enabled, 
          upi_id, bank_name, account_number, ifsc_code, upi_qr_code, 
          support_phone, support_email, support_whatsapp, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
        ON CONFLICT (hotel_id) 
        DO UPDATE SET 
          currency_code = COALESCE(EXCLUDED.currency_code, hotel_settings.currency_code),
          currency_symbol = COALESCE(EXCLUDED.currency_symbol, hotel_settings.currency_symbol),
          task_automation_enabled = COALESCE(EXCLUDED.task_automation_enabled, hotel_settings.task_automation_enabled),
          upi_id = EXCLUDED.upi_id,
          bank_name = EXCLUDED.bank_name,
          account_number = EXCLUDED.account_number,
          ifsc_code = EXCLUDED.ifsc_code,
          upi_qr_code = EXCLUDED.upi_qr_code,
          support_phone = EXCLUDED.support_phone,
          support_email = EXCLUDED.support_email,
          support_whatsapp = EXCLUDED.support_whatsapp,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

            const result = await client.query(updateQuery, [
                hotelId,
                currency_code !== undefined ? currency_code : null,
                currency_symbol !== undefined ? currency_symbol : null,
                task_automation_enabled !== undefined ? task_automation_enabled : null,
                upi_id || null,
                bank_name || null,
                account_number || null,
                ifsc_code || null,
                upi_qr_code || null,
                support_phone || null,
                support_email || null,
                support_whatsapp || null
            ]);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get all active taxes for a hotel
     */
    async getTaxes(hotelId) {
        const query = 'SELECT * FROM taxes WHERE hotel_id = $1 ORDER BY created_at ASC';
        const result = await db.query(query, [hotelId]);
        return result.rows;
    }

    /**
     * Create a new tax
     */
    async createTax(hotelId, taxData) {
        const { name, category, rate, is_inclusive, is_active } = taxData;

        // Check if tax with same name and category exists
        const checkQuery = 'SELECT id FROM taxes WHERE hotel_id = $1 AND name = $2 AND category = $3';
        const checkResult = await db.query(checkQuery, [hotelId, name, category]);

        if (checkResult.rows.length > 0) {
            throw new Error('A tax with this name and category already exists');
        }

        const insertQuery = `
      INSERT INTO taxes (hotel_id, name, category, rate, is_inclusive, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

        const result = await db.query(insertQuery, [
            hotelId, name, category, rate,
            is_inclusive !== undefined ? is_inclusive : false,
            is_active !== undefined ? is_active : true
        ]);

        return result.rows[0];
    }

    /**
     * Update a tax
     */
    async updateTax(hotelId, taxId, taxData) {
        const { name, category, rate, is_inclusive, is_active } = taxData;

        const updateQuery = `
      UPDATE taxes
      SET 
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        rate = COALESCE($3, rate),
        is_inclusive = COALESCE($4, is_inclusive),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND hotel_id = $7
      RETURNING *
    `;

        const result = await db.query(updateQuery, [
            name, category, rate, is_inclusive, is_active, taxId, hotelId
        ]);

        if (result.rows.length === 0) {
            throw new Error('Tax not found');
        }

        return result.rows[0];
    }

    /**
     * Delete a tax
     */
    async deleteTax(hotelId, taxId) {
        const query = 'DELETE FROM taxes WHERE id = $1 AND hotel_id = $2 RETURNING id';
        const result = await db.query(query, [taxId, hotelId]);

        if (result.rows.length === 0) {
            throw new Error('Tax not found');
        }

        return { success: true };
    }
}

module.exports = new SettingsService();
