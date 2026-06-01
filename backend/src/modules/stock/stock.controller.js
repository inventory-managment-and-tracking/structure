'use strict';

const svc = require('./stock.service');

async function list(req, res, next) {
  try {
    const data = await svc.listMovements(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function listForProduct(req, res, next) {
  try {
    const data = await svc.listMovementsForProduct(req.params.productId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { list, listForProduct };
