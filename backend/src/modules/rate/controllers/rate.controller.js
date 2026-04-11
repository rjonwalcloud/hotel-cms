const rateService = require('../services/rate.service');

class RateController {
    // =================== RATE PLANS ===================

    async getRatePlans(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const plans = await rateService.getRatePlans(hotelId);
            res.json({ success: true, data: plans });
        } catch (error) { next(error); }
    }

    async createRatePlan(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const plan = await rateService.createRatePlan(req.body, hotelId);
            res.status(201).json({ success: true, data: plan, message: 'Rate plan created' });
        } catch (error) { next(error); }
    }

    async updateRatePlan(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const plan = await rateService.updateRatePlan(req.params.id, req.body, hotelId);
            res.json({ success: true, data: plan, message: 'Rate plan updated' });
        } catch (error) { next(error); }
    }

    async deleteRatePlan(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            await rateService.deleteRatePlan(req.params.id, hotelId);
            res.json({ success: true, message: 'Rate plan deleted' });
        } catch (error) { next(error); }
    }

    // =================== RATE RULES ===================

    async getRateRules(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const rules = await rateService.getRateRules(hotelId, req.query);
            res.json({ success: true, data: rules });
        } catch (error) { next(error); }
    }

    async createRateRule(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const rule = await rateService.createRateRule(req.body, hotelId);
            res.status(201).json({ success: true, data: rule, message: 'Rate rule created' });
        } catch (error) { next(error); }
    }

    async updateRateRule(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            const rule = await rateService.updateRateRule(req.params.id, req.body, hotelId);
            res.json({ success: true, data: rule, message: 'Rate rule updated' });
        } catch (error) { next(error); }
    }

    async deleteRateRule(req, res, next) {
        try {
            const hotelId = req.params.hotel_id || req.user.hotel_id;
            await rateService.deleteRateRule(req.params.id, hotelId);
            res.json({ success: true, message: 'Rate rule deleted' });
        } catch (error) { next(error); }
    }
}

module.exports = new RateController();
