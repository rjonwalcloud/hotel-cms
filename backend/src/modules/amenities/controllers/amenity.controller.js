const AmenityService = require('../services/amenity.service');

class AmenityController {
    async create(req, res) {
        try {
            const data = await AmenityService.create(req.body, req.user.hotel_id);
            res.status(201).json({ message: 'Amenity created successfully', amenity: data });
        } catch (error) {
            console.error('Create Amenity Error:', error);
            res.status(500).json({ error: error.message || 'Failed to create amenity' });
        }
    }

    async getByHotel(req, res) {
        try {
            const data = await AmenityService.getByHotel(req.user.hotel_id);
            res.json({ amenities: data });
        } catch (error) {
            console.error('Get Amenities Error:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch amenities' });
        }
    }

    async update(req, res) {
        try {
            const { id } = req.params;
            const data = await AmenityService.update(id, req.body, req.user.hotel_id);
            res.json({ message: 'Amenity updated successfully', amenity: data });
        } catch (error) {
            console.error('Update Amenity Error:', error);
            res.status(500).json({ error: error.message || 'Failed to update amenity' });
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.params;
            await AmenityService.delete(id, req.user.hotel_id);
            res.json({ message: 'Amenity deleted successfully' });
        } catch (error) {
            console.error('Delete Amenity Error:', error);
            res.status(500).json({ error: error.message || 'Failed to delete amenity' });
        }
    }
}

module.exports = new AmenityController();
