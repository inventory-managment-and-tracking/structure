'use strict';

const { validationResult } = require('express-validator');
const svc = require('./suppliers.service');

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await svc.listSuppliers() });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    res.json({ success: true, data: await svc.getSupplierById(req.params.id) });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    res.status(201).json({ success: true, data: await svc.createSupplier(req.body) });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    res.json({ success: true, data: await svc.updateSupplier(req.params.id, req.body) });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    res.json({ success: true, data: await svc.deleteSupplier(req.params.id) });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove };
