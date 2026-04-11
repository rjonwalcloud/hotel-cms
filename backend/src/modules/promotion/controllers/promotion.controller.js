const promotionService = require('../services/promotion.service');

class PromotionController {
    // =================== PROMOTIONS ===================

    async getPromotions(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const promos = await promotionService.getPromotions(hotelId);
            res.json({ success: true, data: promos });
        } catch (error) { next(error); }
    }

    async createPromotion(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const promo = await promotionService.createPromotion(req.body, hotelId);
            res.status(201).json({ success: true, data: promo, message: 'Promotion created' });
        } catch (error) { next(error); }
    }

    async updatePromotion(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const promo = await promotionService.updatePromotion(req.params.id, req.body, hotelId);
            res.json({ success: true, data: promo, message: 'Promotion updated' });
        } catch (error) { next(error); }
    }

    async deletePromotion(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            await promotionService.deletePromotion(req.params.id, hotelId);
            res.json({ success: true, message: 'Promotion deleted' });
        } catch (error) { next(error); }
    }

    // =================== COUPON CODES ===================

    async getCouponCodes(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const coupons = await promotionService.getCouponCodes(hotelId);
            res.json({ success: true, data: coupons });
        } catch (error) { next(error); }
    }

    async createCouponCode(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const coupon = await promotionService.createCouponCode(req.body, hotelId);
            res.status(201).json({ success: true, data: coupon, message: 'Coupon code created' });
        } catch (error) { next(error); }
    }

    async updateCouponCode(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const coupon = await promotionService.updateCouponCode(req.params.id, req.body, hotelId);
            res.json({ success: true, data: coupon, message: 'Coupon code updated' });
        } catch (error) { next(error); }
    }

    async deleteCouponCode(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            await promotionService.deleteCouponCode(req.params.id, hotelId);
            res.json({ success: true, message: 'Coupon code deleted' });
        } catch (error) { next(error); }
    }

    async validateCoupon(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const { code, amount, nights, room_type_id } = req.body;
            const result = await promotionService.validateCoupon(code, hotelId, amount, nights, room_type_id);
            res.json({ success: true, data: result });
        } catch (error) { next(error); }
    }
}

module.exports = new PromotionController();
