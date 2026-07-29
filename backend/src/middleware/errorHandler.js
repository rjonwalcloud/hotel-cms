/**
 * Centralized Error Handler Middleware
 * 
 * Provides a consistent error response format and proper error classification.
 * Operational errors (4xx) are returned to the client with their message.
 * Programming errors (5xx) are logged and return a generic message in production.
 */

class AppError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = statusCode < 500;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Express error-handling middleware.
 * Place after all route handlers.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isOperational = statusCode < 500;

  // Log unexpected (non-operational) errors
  if (!isOperational) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    error: isOperational ? err.message : 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      detail: err.message
    })
  });
};

module.exports = { AppError, errorHandler };
