'use strict';

const { getDbStatus } = require('../config/db');

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
    err.code === '42P01' ||
    /connect ECONNREFUSED/i.test(err.message || '');

  let message = err.message || 'Internal server error';

  if (isDbConnectionError && process.env.NODE_ENV === 'production') {
    const dbStatus = getDbStatus();
    message = dbStatus.configured
      ? 'Database connection failed. Confirm Postgres is running and schema.sql was applied.'
      : 'Postgres not linked. Vercel → Storage → Postgres → Connect to Project → Redeploy.';
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
