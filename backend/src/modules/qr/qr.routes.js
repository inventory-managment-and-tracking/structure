'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');
const authorize  = require('../../middleware/authorize');
const ctrl       = require('./qr.controller');

const router = Router();

router.post(
  '/generate/:productId',
  [
    body('copies').optional().isInt({ min: 1, max: 100 }),
    body('print_method').optional().isIn(['qr', 'barcode']),
  ],
  ctrl.generate
);

router.get('/log/product/:productId', authorize('owner', 'manager'), ctrl.getLog);

module.exports = router;
