'use strict';

const { validationResult } = require('express-validator');
const svc = require('./returns.service');

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await svc.listReturns(req.query) });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    res.json({ success: true, data: await svc.getReturnById(req.params.id) });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const ret = await svc.processReturn(req.body, req.user.id);
    res.status(201).json({ success: true, data: ret });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create };
