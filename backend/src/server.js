const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const { initHealthMonitor } = require('./utils/systemHealth');

// Initialize system health monitor
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
const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' && corsOrigin
    ? corsOrigin.split(',').map(o => o.trim())
    : true,
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

// Centralized error handler
app.use((err, req, res, next) => {
  // Distinguish operational errors from programming errors
  const statusCode = err.status || err.statusCode || 500;
  const isOperational = statusCode < 500;

  if (!isOperational) {
    console.error('Unexpected Error:', err);
  } else if (process.env.NODE_ENV === 'development') {
    console.error('Operational Error:', err.message);
  }

  res.status(statusCode).json({
    error: isOperational ? err.message : 'Internal Server Error',
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

// Graceful shutdown helper
const SHUTDOWN_TIMEOUT_MS = 10000; // Force exit after 10s

function gracefulShutdown(signal) {
  console.log(`${signal} received: closing HTTP server`);

  // Force exit if graceful shutdown takes too long
  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(() => {
    console.log('HTTP server closed');
    const db = require('./config/database');
    db.pool.end(() => {
      console.log('Database pool closed');
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled errors to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

module.exports = app;
