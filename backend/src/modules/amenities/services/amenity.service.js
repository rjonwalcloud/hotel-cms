const db = require('../../../config/database');

class AmenityService {
    async create(data, hotelId) {
        const { name, icon, description } = data;
        const query = `
            INSERT INTO amenities (hotel_id, name, icon, description)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const result = await db.query(query, [hotelId, name, icon || null, description || null]);
        return result.rows[0];
    }

    async getByHotel(hotelId) {
        const query = `
            SELECT * FROM amenities 
            WHERE hotel_id = $1 
            ORDER BY name ASC
        `;
        const result = await db.query(query, [hotelId]);
        return result.rows;
    }

    async update(id, data, hotelId) {
        const { name, icon, description } = data;
        const query = `
            UPDATE amenities 
            SET name = $1, icon = $2, description = $3
            WHERE id = $4 AND hotel_id = $5
            RETURNING *
        `;
        const result = await db.query(query, [name, icon || null, description || null, id, hotelId]);
        if (result.rows.length === 0) throw new Error('Amenity not found or access denied');
        return result.rows[0];
    }

    async delete(id, hotelId) {
        const query = 'DELETE FROM amenities WHERE id = $1 AND hotel_id = $2 RETURNING *';
        const result = await db.query(query, [id, hotelId]);
        if (result.rows.length === 0) throw new Error('Amenity not found or access denied');
        return true;
    }
}

module.exports = new AmenityService();
