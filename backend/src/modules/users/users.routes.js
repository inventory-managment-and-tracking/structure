'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');
const authorize  = require('../../middleware/authorize');
const ctrl       = require('./users.controller');

const router = Router();

router.get('/',    authorize('owner', 'manager'), ctrl.list);
router.get('/:id', authorize('owner', 'manager'), ctrl.getOne);

router.post(
  '/',
  authorize('owner'),
  [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['owner', 'manager', 'cashier']).withMessage('Invalid role'),
  ],
  ctrl.create
);

router.patch(
  '/:id',
  authorize('owner'),
  [
    body('full_name').optional().trim().notEmpty(),
    body('username').optional().trim().notEmpty(),
    body('role').optional().isIn(['owner', 'manager', 'cashier']),
    body('is_active').optional().isBoolean(),
  ],
  ctrl.update
);

router.patch(
  '/:id/password',
  authorize('owner'),
  [body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')],
  ctrl.resetPassword
);

router.delete('/:id', authorize('owner'), ctrl.remove);

module.exports = router;
