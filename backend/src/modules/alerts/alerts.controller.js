'use strict';

const svc = require('./alerts.service');

async function listUnresolved(req, res, next) {
  try {
    res.json({ success: true, data: await svc.listUnresolved() });
  } catch (err) { next(err); }
}

async function listAll(req, res, next) {
  try {
    res.json({ success: true, data: await svc.listAll(req.query) });
  } catch (err) { next(err); }
}

async function resolve(req, res, next) {
  try {
    res.json({ success: true, data: await svc.resolveAlert(req.params.id) });
  } catch (err) { next(err); }
}

module.exports = { listUnresolved, listAll, resolve };
