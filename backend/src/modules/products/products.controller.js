'use strict';

const { validationResult } = require('express-validator');
const svc = require('./products.service');

async function list(req, res, next) {
  try {
    const data = await svc.listProducts(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    res.json({ success: true, data: await svc.getProductById(req.params.id) });
  } catch (err) { next(err); }
}

async function getBySku(req, res, next) {
  try {
    res.json({ success: true, data: await svc.getProductBySku(req.params.sku) });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const product = await svc.createProduct(req.body, req.user.id);
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    res.json({ success: true, data: await svc.updateProduct(req.params.id, req.body) });
  } catch (err) { next(err); }
}

async function adjustStock(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const result = await svc.adjustStock(req.params.id, req.body, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    res.json({ success: true, data: await svc.softDeleteProduct(req.params.id) });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, getBySku, create, update, adjustStock, remove };
