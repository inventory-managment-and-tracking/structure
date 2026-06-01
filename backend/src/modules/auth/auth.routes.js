'use strict';

const { Router }        = require('express');
const { body }          = require('express-validator');
const { authenticate }  = require('../../middleware/auth');
const ctrl              = require('./auth.controller');

const router = Router();

router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  ctrl.login
);

router.post('/logout', authenticate, ctrl.logout);

router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
