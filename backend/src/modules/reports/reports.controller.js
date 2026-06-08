'use strict';

const svc = require('./reports.service');

async function getSalesSummary(req, res, next) {
  try {
    res.json({ success: true, data: await svc.salesSummary(req.query) });
  } catch (err) { next(err); }
}

async function getSalesByEmployee(req, res, next) {
  try {
    res.json({ success: true, data: await svc.salesByEmployee(req.query) });
  } catch (err) { next(err); }
}

async function getSalesByProduct(req, res, next) {
  try {
    res.json({ success: true, data: await svc.salesByProduct(req.query) });
  } catch (err) { next(err); }
}

async function getStockHistory(req, res, next) {
  try {
    res.json({ success: true, data: await svc.stockHistory(req.query) });
  } catch (err) { next(err); }
}

async function getStockValuation(req, res, next) {
  try {
    res.json({ success: true, data: await svc.stockValuation() });
  } catch (err) { next(err); }
}

async function getReturnsSummary(req, res, next) {
  try {
    res.json({ success: true, data: await svc.returnsSummary(req.query) });
  } catch (err) { next(err); }
}

async function getSalesTrend(req, res, next) {
  try {
    res.json({ success: true, data: await svc.salesTrend(req.query) });
  } catch (err) { next(err); }
}

async function getDailyStaffActivity(req, res, next) {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'date query param required (YYYY-MM-DD)' });
    }
    res.json({ success: true, data: await svc.dailyStaffActivity(date) });
  } catch (err) { next(err); }
}

module.exports = {
  getSalesSummary, getSalesByEmployee, getSalesByProduct,
  getStockHistory, getStockValuation, getReturnsSummary, getSalesTrend,
  getDailyStaffActivity,
};
