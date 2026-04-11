const subscriptionService = require('../services/subscription.service');

class SubscriptionController {
  // ============================================
  // PLAN ENDPOINTS
  // ============================================

  async createPlan(req, res, next) {
    try {
      const plan = await subscriptionService.createPlan(req.body, req.user.id);
      res.status(201).json({ success: true, message: 'Plan created', plan });
    } catch (error) {
      next(error);
    }
  }

  async getAllPlans(req, res, next) {
    try {
      const includeInactive = req.query.include_inactive === 'true';
      const plans = await subscriptionService.getAllPlans(includeInactive);
      res.json({ success: true, count: plans.length, plans });
    } catch (error) {
      next(error);
    }
  }

  async getPlanById(req, res, next) {
    try {
      const plan = await subscriptionService.getPlanById(req.params.plan_id);
      res.json({ success: true, plan });
    } catch (error) {
      if (error.message === 'Plan not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  async updatePlan(req, res, next) {
    try {
      const plan = await subscriptionService.updatePlan(req.params.plan_id, req.body, req.user.id);
      res.json({ success: true, message: 'Plan updated', plan });
    } catch (error) {
      if (error.message === 'Plan not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  // ============================================
  // SUBSCRIPTION ENDPOINTS
  // ============================================

  async activateSubscription(req, res, next) {
    try {
      const { hotel_id, plan_id, auto_renew } = req.body;
      const subscription = await subscriptionService.activateSubscription(
        hotel_id, plan_id, req.user.id, auto_renew
      );
      res.status(201).json({ success: true, message: 'Subscription activated', subscription });
    } catch (error) {
      if (error.message === 'Hotel not found' || error.message === 'Plan not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  async renewSubscription(req, res, next) {
    try {
      const subscription = await subscriptionService.renewSubscription(
        req.params.subscription_id, req.user.id
      );
      res.json({ success: true, message: 'Subscription renewed', subscription });
    } catch (error) {
      if (error.message === 'Subscription not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  async cancelSubscription(req, res, next) {
    try {
      const { reason } = req.body;
      const subscription = await subscriptionService.cancelSubscription(
        req.params.subscription_id, req.user.id, reason
      );
      res.json({ success: true, message: 'Subscription cancelled', subscription });
    } catch (error) {
      if (error.message === 'Subscription not found') {
        return res.status(404).json({ error: 'Not Found', message: error.message });
      }
      next(error);
    }
  }

  async getHotelSubscription(req, res, next) {
    try {
      const subscription = await subscriptionService.getHotelSubscription(req.params.hotel_id);
      res.json({ success: true, subscription });
    } catch (error) {
      next(error);
    }
  }

  async getAllSubscriptions(req, res, next) {
    try {
      const filters = {
        status: req.query.status,
        hotel_id: req.query.hotel_id
      };
      const subscriptions = await subscriptionService.getAllSubscriptions(filters);
      res.json({ success: true, count: subscriptions.length, subscriptions });
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptionHistory(req, res, next) {
    try {
      const history = await subscriptionService.getSubscriptionHistory(req.params.subscription_id);
      res.json({ success: true, count: history.length, history });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SubscriptionController();
