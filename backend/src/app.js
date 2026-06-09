'use strict';

require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const authRoutes       = require('./modules/auth/auth.routes');
const usersRoutes      = require('./modules/users/users.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const suppliersRoutes  = require('./modules/suppliers/suppliers.routes');
const productsRoutes   = require('./modules/products/products.routes');
const stockRoutes      = require('./modules/stock/stock.routes');
const salesRoutes      = require('./modules/sales/sales.routes');
const returnsRoutes    = require('./modules/returns/returns.routes');
const alertsRoutes     = require('./modules/alerts/alerts.routes');
const qrRoutes         = require('./modules/qr/qr.routes');
const reportsRoutes    = require('./modules/reports/reports.routes');

const { authenticate }  = require('./middleware/auth');
const errorHandler      = require('./middleware/errorHandler');

const app = express();

// ── Security & logging ────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'ClothTrack API is running', timestamp: new Date() });
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'ClothTrack API is running', timestamp: new Date() });
});

// ── Public routes (no JWT required) ───────────────────────────
app.use('/api/auth', authRoutes);

// ── Protected routes (JWT required for all below) ─────────────
app.use('/api', authenticate);
app.use('/api/users',      usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/suppliers',  suppliersRoutes);
app.use('/api/products',   productsRoutes);
app.use('/api/stock',      stockRoutes);
app.use('/api/sales',      salesRoutes);
app.use('/api/returns',    returnsRoutes);
app.use('/api/alerts',     alertsRoutes);
app.use('/api/qr',         qrRoutes);
app.use('/api/reports',    reportsRoutes);

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
