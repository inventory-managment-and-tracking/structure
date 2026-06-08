'use strict';

const { Router } = require('express');
const authorize  = require('../../middleware/authorize');
const ctrl       = require('./reports.controller');

const router = Router();

router.get('/sales/summary',     authorize('owner', 'cashier'), ctrl.getSalesSummary);
router.get('/sales/by-employee', authorize('owner'),            ctrl.getSalesByEmployee);
router.get('/sales/by-product',  authorize('owner', 'cashier'), ctrl.getSalesByProduct);
router.get('/sales/trend',       authorize('owner', 'cashier'), ctrl.getSalesTrend);
router.get('/stock/history',     authorize('owner', 'cashier'), ctrl.getStockHistory);
router.get('/stock/valuation',   authorize('owner'),            ctrl.getStockValuation);
router.get('/returns/summary',   authorize('owner', 'cashier'), ctrl.getReturnsSummary);

module.exports = router;
