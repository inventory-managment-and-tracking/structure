'use strict';

const { validationResult } = require('express-validator');
const svc = require('./sales.service');

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await svc.listSales(req.query) });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    res.json({ success: true, data: await svc.getSaleById(req.params.id) });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const sale = await svc.createSale(req.body, req.user.id);
    res.status(201).json({ success: true, data: sale });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create };
