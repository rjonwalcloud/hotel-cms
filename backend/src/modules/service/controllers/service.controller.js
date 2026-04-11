const serviceManagementService = require('../services/service.service');

class ServiceController {
  // ============================================
  // CATEGORY CONTROLLERS
  // ============================================

  /**
   * POST /api/services/categories
   */
  async createCategory(req, res, next) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      if (!hotelId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Hotel ID is required'
        });
      }

      const category = await serviceManagementService.createCategory(
        req.body,
        req.user.id,
        hotelId
      );

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        category
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/services/categories/hotel/:hotel_id
   */
  async getCategoriesByHotel(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const categories = await serviceManagementService.getCategoriesByHotel(hotel_id);

      res.json({
        success: true,
        count: categories.length,
        categories
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/services/categories/:category_id
   */
  async updateCategory(req, res, next) {
    try {
      const { category_id } = req.params;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      const category = await serviceManagementService.updateCategory(
        category_id,
        req.body,
        req.user.id,
        hotelId
      );

      res.json({
        success: true,
        message: 'Category updated successfully',
        category
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/services/categories/:category_id
   */
  async deleteCategory(req, res, next) {
    try {
      const { category_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;

      await serviceManagementService.deleteCategory(category_id, req.user.id, hotelId);

      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      if (error.message.includes('existing items')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }
      next(error);
    }
  }

  // ============================================
  // SERVICE ITEM CONTROLLERS
  // ============================================

  /**
   * POST /api/services/items
   */
  async createItem(req, res, next) {
    try {
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      if (!hotelId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Hotel ID is required'
        });
      }

      const item = await serviceManagementService.createItem(
        req.body,
        req.user.id,
        hotelId
      );

      res.status(201).json({
        success: true,
        message: 'Service item created successfully',
        item
      });
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/services/items/hotel/:hotel_id
   */
  async getItemsByHotel(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const filters = {
        category_id: req.query.category_id,
        is_available: req.query.is_available === 'true' ? true : req.query.is_available === 'false' ? false : undefined
      };

      const items = await serviceManagementService.getItemsByHotel(hotel_id, filters);

      res.json({
        success: true,
        count: items.length,
        items
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/services/items/:item_id
   */
  async getItemById(req, res, next) {
    try {
      const { item_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;

      const item = await serviceManagementService.getItemById(item_id, hotelId);

      res.json({
        success: true,
        item
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * PUT /api/services/items/:item_id
   */
  async updateItem(req, res, next) {
    try {
      const { item_id } = req.params;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      const item = await serviceManagementService.updateItem(
        item_id,
        req.body,
        req.user.id,
        hotelId
      );

      res.json({
        success: true,
        message: 'Service item updated successfully',
        item
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * PATCH /api/services/items/:item_id/availability
   */
  async toggleItemAvailability(req, res, next) {
    try {
      const { item_id } = req.params;
      const { is_available } = req.body;
      const hotelId = req.body.hotel_id || req.user.hotel_id;

      if (is_available === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'is_available field is required'
        });
      }

      const item = await serviceManagementService.toggleItemAvailability(
        item_id,
        is_available,
        req.user.id,
        hotelId
      );

      res.json({
        success: true,
        message: `Item ${is_available ? 'enabled' : 'disabled'} successfully`,
        item
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/services/items/:item_id
   */
  async deleteItem(req, res, next) {
    try {
      const { item_id } = req.params;
      const hotelId = req.query.hotel_id || req.user.hotel_id;

      await serviceManagementService.deleteItem(item_id, req.user.id, hotelId);

      res.json({
        success: true,
        message: 'Service item deleted successfully'
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }
      if (error.message.includes('existing service requests')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }
      next(error);
    }
  }
}

module.exports = new ServiceController();
