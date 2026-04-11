const creditNoteService = require('../services/credit-note.service');

class CreditNoteController {
  async create(req, res) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;
      const cn = await creditNoteService.create(req.body, req.user.id, hotelId);
      res.status(201).json(cn);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getByHotel(req, res) {
    try {
      const hotelId = req.params.hotel_id;
      const { status, search } = req.query;
      const creditNotes = await creditNoteService.getByHotel(hotelId, { status, search });
      res.json({ creditNotes });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const hotelId = req.query.hotel_id || req.user.hotel_id;
      const cn = await creditNoteService.getById(req.params.id, hotelId);
      res.json(cn);
    } catch (error) {
      res.status(error.message === 'Credit note not found' ? 404 : 500).json({ error: error.message });
    }
  }

  async approve(req, res) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;
      const result = await creditNoteService.approve(req.params.id, req.user.id, hotelId);
      res.json(result);
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
    }
  }

  async reject(req, res) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;
      const result = await creditNoteService.reject(req.params.id, req.user.id, hotelId, req.body.reason);
      res.json(result);
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
    }
  }
}

module.exports = new CreditNoteController();
