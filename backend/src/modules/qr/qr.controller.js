'use strict';

const { validationResult } = require('express-validator');
const svc = require('./qr.service');

async function generate(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const result = await svc.generateQR(req.params.productId, req.body, req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function getLog(req, res, next) {
  try {
    res.json({ success: true, data: await svc.getPrintLog(req.params.productId) });
  } catch (err) { next(err); }
}

module.exports = { generate, getLog };
