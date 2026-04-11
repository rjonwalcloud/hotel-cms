const db = require('../../../config/database');
const bcrypt = require('bcrypt');

class UserService {
    /**
     * List all users for a specific hotel with their roles
     */
    async listUsersByHotel(hotelId) {
        const query = `
      SELECT 
        u.id, 
        u.email, 
        u.full_name, 
        u.phone, 
        u.is_active, 
        u.created_at,
        r.name as role_name,
        r.id as role_id,
        ur.custom_permissions
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.hotel_id = $1
      ORDER BY u.created_at DESC
    `;
        const res = await db.query(query, [hotelId]);
        return res.rows;
    }

    /**
     * Create a new user for a hotel with quota check
     */
    async createUser(userData, adminId) {
        const { email, password, full_name, phone, role_name, hotel_id } = userData;

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Quota Check
            const quotaQuery = `
        SELECT hl.max_value, COALESCE(uc.current_value, 0) as current_value
        FROM hotel_limits hl
        JOIN policy_limits pl ON pl.id = hl.policy_limit_id
        LEFT JOIN usage_counters uc ON uc.hotel_id = hl.hotel_id AND uc.policy_limit_id = hl.policy_limit_id
        WHERE hl.hotel_id = $1 AND pl.key = 'user_create'
      `;
            const quotaRes = await client.query(quotaQuery, [hotel_id]);

            if (quotaRes.rows.length > 0) {
                const { max_value, current_value } = quotaRes.rows[0];
                if (current_value >= max_value) {
                    throw new Error('User creation limit reached for this hotel. Please upgrade your plan.');
                }
            }

            // 2. Check if user exists
            const existingRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existingRes.rows.length > 0) {
                throw new Error('User with this email already exists');
            }

            // 3. Hash password
            const password_hash = await bcrypt.hash(password, 10);

            // 4. Insert user
            const userInsert = `
        INSERT INTO users (email, password_hash, full_name, phone)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, full_name
      `;
            const userRes = await client.query(userInsert, [email, password_hash, full_name, phone]);
            const newUser = userRes.rows[0];

            // 5. Assign Role
            const roleInsert = `
        INSERT INTO user_roles (user_id, role_id, hotel_id, assigned_by, custom_permissions)
        SELECT $1, r.id, $3, $4, $5
        FROM roles r WHERE r.name = $2
      `;
            const customPermsJSON = userData.custom_permissions ? JSON.stringify(userData.custom_permissions) : null;
            await client.query(roleInsert, [newUser.id, role_name, hotel_id, adminId, customPermsJSON]);

            // 6. Increment Usage Counter
            const counterUpdate = `
        INSERT INTO usage_counters (hotel_id, policy_limit_id, current_value)
        SELECT $1, id, 1 FROM policy_limits WHERE key = 'user_create'
        ON CONFLICT (hotel_id, policy_limit_id)
        DO UPDATE SET current_value = usage_counters.current_value + 1, updated_at = CURRENT_TIMESTAMP
      `;
            await client.query(counterUpdate, [hotel_id]);

            await client.query('COMMIT');
            return newUser;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update user details and role
     */
    async updateUser(userId, hotelId, updates) {
        const { full_name, phone, role_name, is_active } = updates;

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Update user basic info
            const userUpdate = `
        UPDATE users 
        SET full_name = $1, phone = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, email, full_name
      `;
            const userRes = await client.query(userUpdate, [full_name, phone, is_active, userId]);

            if (userRes.rows.length === 0) {
                throw new Error('User not found');
            }

            // 2. Update role and/or custom permissions
            if (role_name || updates.custom_permissions !== undefined) {
                let customPermsJSON;
                if (updates.custom_permissions === null) {
                    customPermsJSON = null;
                } else if (Array.isArray(updates.custom_permissions)) {
                    customPermsJSON = JSON.stringify(updates.custom_permissions);
                }

                // Use COALESCE in SET to preserve existing role if role_name is falsy
                const roleUpdate = `
          UPDATE user_roles
          SET 
             role_id = COALESCE((SELECT id FROM roles WHERE name = $1), role_id),
             custom_permissions = COALESCE($4::jsonb, custom_permissions)
          WHERE user_id = $2 AND hotel_id = $3
        `;

                // If updates.custom_permissions is literally null, we want to clear them. 
                // However, the COALESCE logic above prevents us from setting it to null using $4 directly.
                // It's cleaner to just fire an explicit update query for the custom permissions array.
                const finalCustomPerms = updates.custom_permissions === null ? null : (updates.custom_permissions ? JSON.stringify(updates.custom_permissions) : undefined);

                if (role_name) {
                    const safeRoleUpdate = `
                    UPDATE user_roles
                    SET role_id = (SELECT id FROM roles WHERE name = $1)
                    WHERE user_id = $2 AND hotel_id = $3
                  `;
                    await client.query(safeRoleUpdate, [role_name, userId, hotelId]);
                }

                if (updates.custom_permissions !== undefined) {
                    const safePermsUpdate = `
                     UPDATE user_roles
                     SET custom_permissions = $1::jsonb
                     WHERE user_id = $2 AND hotel_id = $3
                  `;
                    await client.query(safePermsUpdate, [finalCustomPerms, userId, hotelId]);
                }
            }

            await client.query('COMMIT');
            return userRes.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Delete user and decrement counter
     */
    async deleteUser(userId, hotelId) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Verify user exists and get hotel_id (redundant usually but safe)
            const verifyRes = await client.query('SELECT user_id FROM user_roles WHERE user_id = $1 AND hotel_id = $2', [userId, hotelId]);
            if (verifyRes.rows.length === 0) {
                throw new Error('User not found in this hotel');
            }

            // 2. Delete user (cascades to user_roles)
            await client.query('DELETE FROM users WHERE id = $1', [userId]);

            // 3. Decrement usage counter
            const counterUpdate = `
        UPDATE usage_counters
        SET current_value = GREATEST(0, current_value - 1), updated_at = CURRENT_TIMESTAMP
        WHERE hotel_id = $1 AND policy_limit_id = (SELECT id FROM policy_limits WHERE key = 'user_create')
      `;
            await client.query(counterUpdate, [hotelId]);

            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update menu visibility for users
     * Can be single user or bulk by role/hotel
     */
    async updateMenuVisibility({ hotelIds, roleName, userIds, hiddenMenuItems }) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const hiddenItemsJSON = JSON.stringify(hiddenMenuItems);

            if (userIds && userIds.length > 0) {
                // Update specific users across their roles in selected hotels
                const query = `
                    UPDATE user_roles
                    SET hidden_menu_items = $1::jsonb
                    WHERE user_id = ANY($2::uuid[])
                    AND (hotel_id = ANY($3::uuid[]) OR hotel_id IS NULL)
                `;
                await client.query(query, [hiddenItemsJSON, userIds, hotelIds]);
            } else if (roleName && hotelIds && hotelIds.length > 0) {
                // Bulk update by role name for selected hotels
                const query = `
                    UPDATE user_roles ur
                    SET hidden_menu_items = $1::jsonb
                    FROM roles r
                    WHERE ur.role_id = r.id
                    AND r.name = $2
                    AND ur.hotel_id = ANY($3::uuid[])
                `;
                await client.query(query, [hiddenItemsJSON, roleName, hotelIds]);
            } else {
                throw new Error('Invalid update parameters: userIds or roleName/hotelIds required');
            }

            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new UserService();
