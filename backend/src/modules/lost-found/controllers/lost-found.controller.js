const lostFoundService = require('../services/lost-found.service');

class LostFoundController {
  async create(req, res) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;
      const item = await lostFoundService.create(req.body, req.user.id, hotelId);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getByHotel(req, res) {
    try {
      const hotelId = req.params.hotel_id;
      const { type, status, item_category, location, search } = req.query;
      const items = await lostFoundService.getByHotel(hotelId, { type, status, item_category, location, search });
      res.json({ items });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const hotelId = req.query.hotel_id || req.user.hotel_id;
      const item = await lostFoundService.getById(req.params.id, hotelId);
      res.json(item);
    } catch (error) {
      res.status(error.message === 'Item not found' ? 404 : 500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;
      const item = await lostFoundService.update(req.params.id, req.body, req.user.id, hotelId);
      res.json(item);
    } catch (error) {
      res.status(error.message === 'Item not found' ? 404 : 500).json({ error: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;
      const item = await lostFoundService.updateStatus(req.params.id, req.body.status, req.user.id, hotelId);
      res.json(item);
    } catch (error) {
      res.status(error.message === 'Item not found' ? 404 : 400).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const hotelId = req.query.hotel_id || req.user.hotel_id;
      await lostFoundService.delete(req.params.id, hotelId);
      res.json({ success: true });
    } catch (error) {
      res.status(error.message === 'Item not found' ? 404 : 500).json({ error: error.message });
    }
  }
}

module.exports = new LostFoundController();
