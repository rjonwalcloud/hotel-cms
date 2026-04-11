const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotion.controller');
const authMiddleware = require('../../../middleware/auth.middleware');
const { requirePermission } = require('../../../middleware/rbac.middleware');

// Promotions
router.get('/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_VIEW'), promotionController.getPromotions);
router.post('/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), promotionController.createPromotion);
router.put('/:id/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), promotionController.updatePromotion);
router.delete('/:id/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), promotionController.deletePromotion);

// Coupon Codes
router.get('/coupons/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_VIEW'), promotionController.getCouponCodes);
router.post('/coupons/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), promotionController.createCouponCode);
router.put('/coupons/:id/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), promotionController.updateCouponCode);
router.delete('/coupons/:id/hotel/:hotel_id', authMiddleware, requirePermission('BOOKING_CREATE'), promotionController.deleteCouponCode);

// Validate Coupon
router.post('/coupons/validate/hotel/:hotel_id', authMiddleware, promotionController.validateCoupon);

module.exports = router;
