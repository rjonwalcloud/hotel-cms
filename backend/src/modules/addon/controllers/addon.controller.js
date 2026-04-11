const addonService = require('../services/addon.service');

class AddonController {
  async createAddon(req, res, next) {
    try {
      const hotelId = req.user.hotel_id || req.params.hotel_id || req.body.hotel_id;
      const addon = await addonService.createAddon(req.body, req.user.id, hotelId);
      res.status(201).json({ success: true, addon });
    } catch (error) {
      next(error);
    }
  }

  async getAddons(req, res, next) {
    try {
      const hotelId = req.user.hotel_id || req.params.hotel_id;
      const addons = await addonService.getAddonsByHotel(hotelId);
      res.json({ success: true, addons });
    } catch (error) {
      next(error);
    }
  }

  async updateAddon(req, res, next) {
    try {
      const hotelId = req.user.hotel_id || req.params.hotel_id;
      const { id } = req.params;
      const addon = await addonService.updateAddon(id, req.body, req.user.id, hotelId);
      res.json({ success: true, addon });
    } catch (error) {
      next(error);
    }
  }

  async deleteAddon(req, res, next) {
    try {
      const hotelId = req.user.hotel_id || req.params.hotel_id;
      const { id } = req.params;
      await addonService.deleteAddon(id, req.user.id, hotelId);
      res.json({ success: true, message: 'Addon deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AddonController();
