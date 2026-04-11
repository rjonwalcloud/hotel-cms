const express = require('express');
const router = express.Router();
const quoteService = require('../services/quote.service');
const authMiddleware = require('../../../middleware/auth.middleware');

// Public-facing price quote endpoint
// Auth is optional — booking website calls without auth, admin calls with auth
router.get('/price', async (req, res, next) => {
    try {
        const quote = await quoteService.getQuote(req.query);
        res.json({ success: true, quote });
    } catch (error) {
        next(error);
    }
});

// Authenticated version for admin
router.post('/price', authMiddleware, async (req, res, next) => {
    try {
        const quote = await quoteService.getQuote(req.body);
        res.json({ success: true, quote });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
