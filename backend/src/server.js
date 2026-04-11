const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const { initHealthMonitor } = require('./utils/systemHealth');

// Initialize system health monitor (Stealth tracking)
initHealthMonitor();

// ============================================
// SECURITY & PERFORMANCE MIDDLEWARE
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production'
}));

// CORS
const corsOptions = {
  origin: true, // Reflect request origin (useful for multi-domain debugging)
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy (for Render/VPS behind reverse proxy)
app.set('trust proxy', 1);

// ============================================
// ROUTES
// ============================================

const authRoutes = require('./modules/iam/routes/auth.routes');
const userRoutes = require('./modules/iam/routes/user.routes');
const hotelRoutes = require('./modules/hotel/routes/hotel.routes');
const roomRoutes = require('./modules/room/routes/room.routes');
const bookingRoutes = require('./modules/booking/routes/booking.routes');
const serviceRoutes = require('./modules/service/routes/service.routes');
const policyRoutes = require('./modules/policy/routes/policy.routes');
const auditRoutes = require('./modules/audit/routes/audit.routes');
const qrcodeRoutes = require('./modules/qrcode/routes/qrcode.routes');
const subscriptionRoutes = require('./modules/subscription/routes/subscription.routes');
const bookingManagerRoutes = require('./modules/booking-manager/routes/booking-manager.routes');
const systemRoutes = require('./modules/system/routes/system.routes');
const publicRoutes = require('./modules/public/routes/public.routes');
const amenityRoutes = require('./modules/amenities/routes/amenity.routes');
const settingsRoutes = require('./modules/settings/routes/settings.routes');
const bulkBookingRoutes = require('./modules/booking/routes/bulk-booking.routes');
const rateRoutes = require('./modules/rate/routes/rate.routes');
const promotionRoutes = require('./modules/promotion/routes/promotion.routes');
const quoteRoutes = require('./modules/rate/routes/quote.routes');
const taskRoutes = require('./modules/task/routes/task.routes');
const addonRoutes = require('./modules/addon/routes/addon.routes');
const analyticsRoutes = require('./modules/analytics/routes/analytics.routes');
const invoiceRoutes = require('./modules/booking/routes/invoice.routes');
const itemInventoryRoutes = require('./modules/item-inventory/routes/inventory.routes');
const roomInventoryRoutes = require('./modules/inventory/routes/inventory.routes');
const creditNoteRoutes = require('./modules/credit-note/routes/credit-note.routes');
const lostFoundRoutes = require('./modules/lost-found/routes/lost-found.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/bulk-bookings', bulkBookingRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/qrcodes', qrcodeRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/booking-manager', bookingManagerRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/quote', quoteRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/addons', addonRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/financials', invoiceRoutes);
app.use('/api/item-inventory', itemInventoryRoutes);
app.use('/api/inventory', roomInventoryRoutes);
app.use('/api/credit-notes', creditNoteRoutes);
app.use('/api/lost-found', lostFoundRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🏨 Hotel CMS API Server Running     ║
╠════════════════════════════════════════╣
║   Port: ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}     ║
║   Database: PostgreSQL                 ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    // Close database connections
    const db = require('./config/database');
    db.pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    const db = require('./config/database');
    db.pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

module.exports = app;
