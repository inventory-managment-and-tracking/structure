'use strict';

const { validationResult } = require('express-validator');
const authService = require('./auth.service');

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, password } = req.body;
    const result = await authService.login(username, password);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function logout(_req, res) {
  res.json({ success: true, message: 'Logged out successfully' });
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, getMe };
