'use strict';

const { Router } = require('express');
const authorize  = require('../../middleware/authorize');
const ctrl       = require('./reports.controller');

const router = Router();

router.get('/sales/summary',     authorize('owner', 'manager'), ctrl.getSalesSummary);
router.get('/sales/by-employee', authorize('owner'),            ctrl.getSalesByEmployee);
router.get('/sales/by-product',  authorize('owner', 'manager'), ctrl.getSalesByProduct);
router.get('/stock/history',     authorize('owner', 'manager'), ctrl.getStockHistory);
router.get('/stock/valuation',   authorize('owner'),            ctrl.getStockValuation);
router.get('/returns/summary',   authorize('owner', 'manager'), ctrl.getReturnsSummary);

module.exports = router;
