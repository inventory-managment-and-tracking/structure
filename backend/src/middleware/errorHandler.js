'use strict';

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);
  }

  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'A record with that value already exists',
      detail: err.detail || undefined,
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
      detail: err.detail || undefined,
    });
  }

  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      message: 'Value violates a check constraint',
    });
  }

  const isDbConnectionError =
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ETIMEDOUT' ||
    /connect ECONNREFUSED/i.test(err.message || '');

  const message = isDbConnectionError && process.env.NODE_ENV === 'production'
    ? 'Database connection failed. Check that Postgres is linked to this deployment.'
    : (err.message || 'Internal server error');

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
