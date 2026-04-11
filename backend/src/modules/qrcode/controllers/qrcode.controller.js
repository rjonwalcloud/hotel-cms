const qrcodeService = require('../services/qrcode.service');
const crypto = require('crypto');

class QRCodeController {
  /**
   * POST /api/qrcodes/generate
   * Generate QR code for a room
   */
  async generateQRCode(req, res, next) {
    try {
      const { room_id, hotel_id, frontend_url } = req.body;

      let baseUrl = frontend_url || process.env.FRONTEND_URL;

      if (!baseUrl && process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*') {
        // Use first origin if comma separated
        baseUrl = process.env.CORS_ORIGIN.split(',')[0].trim();
      }

      if (!baseUrl) {
        baseUrl = `${req.protocol}://${req.get('host')}`;
      }

      // Remove trailing slash if present
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }

      const qrCode = await qrcodeService.generateQRCode(
        room_id, hotel_id, req.user.id, baseUrl
      );

      res.status(201).json({
        success: true,
        message: 'QR code generated successfully',
        qrCode
      });
    } catch (error) {
      if (error.message === 'Room not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * POST /api/qrcodes/bulk-generate
   * Generate QR codes for all rooms in a hotel
   */
  async bulkGenerate(req, res, next) {
    try {
      const { hotel_id, frontend_url } = req.body;

      let baseUrl = frontend_url || process.env.FRONTEND_URL;

      if (!baseUrl && process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*') {
        baseUrl = process.env.CORS_ORIGIN.split(',')[0].trim();
      }

      if (!baseUrl) {
        baseUrl = `${req.protocol}://${req.get('host')}`;
      }

      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }

      const qrCodes = await qrcodeService.bulkGenerateQRCodes(
        hotel_id, req.user.id, baseUrl
      );

      res.status(201).json({
        success: true,
        message: `${qrCodes.length} QR codes generated`,
        count: qrCodes.length,
        qrCodes
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/qrcodes/hotel/:hotel_id
   * Get all QR codes for a hotel
   */
  async getByHotel(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const qrCodes = await qrcodeService.getQRCodesByHotel(hotel_id);

      res.json({
        success: true,
        count: qrCodes.length,
        qrCodes
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/qrcodes/scan/:token
   * Public endpoint - Get room info by QR token
   */
  async scanQRCode(req, res, next) {
    try {
      const { token } = req.params;
      const data = await qrcodeService.getRoomServices(token);

      res.json({
        success: true,
        ...data
      });
    } catch (error) {
      if (error.message === 'QR code not found or inactive') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * POST /api/qrcodes/scan/:token/request
   * Public endpoint - Create service request via QR
   */
  async createServiceRequest(req, res, next) {
    try {
      const { token } = req.params;
      const request = await qrcodeService.createServiceRequest(token, req.body);

      res.status(201).json({
        success: true,
        message: 'Service request submitted',
        request
      });
    } catch (error) {
      if (error.message === 'QR code not found or inactive') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * GET /api/qrcodes/requests/hotel/:hotel_id
   * Get service requests for a hotel
   */
  async getServiceRequests(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const filters = {
        status: req.query.status,
        room_id: req.query.room_id
      };

      const requests = await qrcodeService.getServiceRequests(hotel_id, filters);

      res.json({
        success: true,
        count: requests.length,
        requests
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/qrcodes/requests/:request_id/status
   * Update service request status
   */
  async updateServiceRequestStatus(req, res, next) {
    try {
      const { request_id } = req.params;
      const { status, hotel_id } = req.body;

      const request = await qrcodeService.updateServiceRequestStatus(
        request_id, status, hotel_id, req.user.id
      );

      res.json({
        success: true,
        message: 'Service request updated',
        request
      });
    } catch (error) {
      if (error.message === 'Service request not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * GET /api/qrcodes/requests/:request_id/details
   * Get full service request details with history
   */
  async getServiceRequestDetails(req, res, next) {
    try {
      const { request_id } = req.params;
      const data = await qrcodeService.getServiceRequestDetails(request_id);
      res.json({ success: true, ...data });
    } catch (error) {
      if (error.message === 'Service request not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/qrcodes/:qr_id
   * Deactivate QR code
   */
  async deleteQRCode(req, res, next) {
    try {
      const { qr_id } = req.params;
      const { hotel_id } = req.query;

      const result = await qrcodeService.deleteQRCode(qr_id, hotel_id, req.user.id);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      if (error.message === 'QR code not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * POST /api/qrcodes/scan/:token/request/bulk
   * Public endpoint - Create multiple service requests via QR
   */
  async createBulkServiceRequests(req, res, next) {
    try {
      const { token } = req.params;
      const { services, guest_name, guest_phone, notes } = req.body;

      if (!services || !Array.isArray(services)) {
        return res.status(400).json({ error: 'Bad Request', message: 'services array is required' });
      }

      // Fetch all items to get their categories for grouping
      const itemIds = services.map(s => s.service_item_id);
      const itemsInfo = await qrcodeService.getServiceItemsByIds(itemIds);
      
      const categoryMap = {};
      itemsInfo.forEach(item => {
        categoryMap[item.id] = item.category_id;
      });

      // Group items by category and assign a unique group ID to each category
      const categoryGroupIds = {};
      const requests = [];
      
      for (const service of services) {
        const catId = categoryMap[service.service_item_id] || 'default';
        if (!categoryGroupIds[catId]) {
          categoryGroupIds[catId] = crypto.randomUUID();
        }
        
        const request = await qrcodeService.createServiceRequest(token, {
          service_item_id: service.service_item_id,
          guest_name,
          guest_phone,
          quantity: service.quantity || 1,
          notes: notes || '',
          order_group_id: categoryGroupIds[catId],
          status: req.body.status || 'PENDING',
          is_billed: req.body.is_billed || false,
          payment_method: req.body.payment_method || null,
          invoice_number: req.body.invoice_number || null
        });
        requests.push(request);
      }

      res.status(201).json({
        success: true,
        message: `${requests.length} service requests submitted in ${Object.keys(categoryGroupIds).length} groups`,
        count: requests.length,
        groupsCount: Object.keys(categoryGroupIds).length,
        requests
      });
    } catch (error) {
      if (error.message === 'QR code not found or inactive') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * GET /api/qrcodes/scan/:token/orders
   * Public endpoint - Get guest's orders for current stay
   */
  async getGuestOrders(req, res, next) {
    try {
      const { token } = req.params;
      const data = await qrcodeService.getGuestOrders(token);

      res.json({
        success: true,
        ...data
      });
    } catch (error) {
      if (error.message === 'QR code not found or inactive') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * PATCH /api/qrcodes/:qr_id/status
   * Toggle QR code status (active/inactive)
   */
  async toggleQRCodeStatus(req, res, next) {
    try {
      const { qr_id } = req.params;
      const { is_active, hotel_id } = req.body;

      if (is_active === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'is_active field is required'
        });
      }

      const qrCode = await qrcodeService.toggleQRCodeStatus(
        qr_id, hotel_id, is_active, req.user.id
      );

      res.json({
        success: true,
        message: `QR code ${is_active ? 'activated' : 'deactivated'} successfully`,
        qrCode
      });
    } catch (error) {
      if (error.message === 'QR code not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * PATCH /api/qrcodes/requests/bulk-status
   * Bulk update status for multiple requests (partial fulfillments)
   */
  async bulkUpdateServiceRequestStatus(req, res, next) {
    try {
      const { updates, hotel_id } = req.body;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ error: 'Bad Request', message: 'updates array is required' });
      }

      const results = await qrcodeService.bulkUpdateServiceRequestStatus(
        updates, hotel_id, req.user.id
      );

      res.json({
        success: true,
        message: 'Service requests updated successfully',
        updatedCount: results.length,
        results
      });
    } catch (error) {
      if (error.message === 'Service request not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  /**
   * POST /api/qrcodes/requests/hotel/:hotel_id/bulk
   * Staff endpoint - Place bulk orders for a guest/room directly (Restaurant POS)
   */
  async createBulkServiceRequestsStaff(req, res, next) {
    try {
      const { hotel_id } = req.params;
      const { 
        services, guest_name, guest_phone, notes, 
        booking_id, room_id, status, is_billed, 
        payment_method, invoice_number 
      } = req.body;

      if (!services || !Array.isArray(services)) {
        return res.status(400).json({ error: 'Bad Request', message: 'services array is required' });
      }

      // Group items by category to split orders if needed
      const itemIds = services.map(s => s.service_item_id);
      const itemsInfo = await qrcodeService.getServiceItemsByIds(itemIds);
      
      const categoryMap = {};
      itemsInfo.forEach(item => {
        categoryMap[item.id] = item.category_id;
      });

      const categoryGroupIds = {};
      const requests = [];
      
      for (const service of services) {
        const catId = categoryMap[service.service_item_id] || 'default';
        if (!categoryGroupIds[catId]) {
          categoryGroupIds[catId] = crypto.randomUUID();
        }
        
        const request = await qrcodeService.createServiceRequestStaff({
          hotel_id,
          room_id,
          booking_id,
          service_item_id: service.service_item_id,
          guest_name,
          guest_phone,
          quantity: service.quantity || 1,
          notes: notes || '',
          order_group_id: categoryGroupIds[catId],
          status: status || 'ACCEPTED',
          is_billed: is_billed || false,
          payment_method: payment_method || null,
          invoice_number: invoice_number || null
        });
        requests.push(request);
      }

      res.status(201).json({
        success: true,
        message: `${requests.length} POS orders created successfully`,
        count: requests.length,
        groupsCount: Object.keys(categoryGroupIds).length,
        requests
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QRCodeController();
