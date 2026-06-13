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

async function getMyReport(req, res, next) {
  try {
    const { date_from, date_to } = req.query;
    if ((date_from && !date_to) || (!date_from && date_to)) {
      return res.status(400).json({
        success: false,
        message: 'Both date_from and date_to are required (YYYY-MM-DD)',
      });
    }
    if (date_from && !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      return res.status(400).json({ success: false, message: 'date_from must be YYYY-MM-DD' });
    }
    if (date_to && !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
      return res.status(400).json({ success: false, message: 'date_to must be YYYY-MM-DD' });
    }
    if (date_from && date_to && date_from > date_to) {
      return res.status(400).json({ success: false, message: 'date_from cannot be after date_to' });
    }
    res.json({
      success: true,
      data: await svc.myReport(req.user.id, { date_from, date_to }),
    });
  } catch (err) { next(err); }
}

module.exports = {
  getSalesSummary, getSalesByEmployee, getSalesByProduct,
  getStockHistory, getStockValuation, getReturnsSummary, getSalesTrend,
  getDailyStaffActivity, getMyReport,
};
