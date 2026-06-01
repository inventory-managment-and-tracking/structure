'use strict';

const { Router } = require('express');
const authorize  = require('../../middleware/authorize');
const ctrl       = require('./stock.controller');

const router = Router();

router.get('/',                    authorize('owner', 'manager'), ctrl.list);
router.get('/product/:productId',  ctrl.listForProduct);

module.exports = router;
