'use strict';

const { validationResult } = require('express-validator');
const svc = require('./users.service');

async function list(req, res, next) {
  try {
    const users = await svc.listUsers();
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const user = await svc.getUserById(req.params.id);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const user = await svc.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const user = await svc.updateUser(req.params.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const result = await svc.resetPassword(req.params.id, req.body.password);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const user = await svc.softDeleteUser(req.params.id, req.user.id);
    res.json({ success: true, data: user, message: 'User deactivated' });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, resetPassword, remove };
