'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');
const authorize  = require('../../middleware/authorize');
const ctrl       = require('./sales.controller');

const router = Router();

router.get('/',    authorize('owner', 'cashier'), ctrl.list);
router.get('/:id', ctrl.getOne);

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.product_id').isInt({ gt: 0 }).withMessage('Each item must have a valid product_id'),
    body('items.*.quantity').isInt({ gt: 0 }).withMessage('Each item quantity must be > 0'),
    body('items.*.unit_price').optional().isFloat({ gt: 0 }),
    body('payment_method')
      .optional()
      .isIn(['cash', 'card', 'mobile_money', 'other'])
      .withMessage('Invalid payment method'),
  ],
  ctrl.create
);

module.exports = router;
