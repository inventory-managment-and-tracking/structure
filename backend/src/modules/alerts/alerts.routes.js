'use strict';

const { Router } = require('express');
const authorize  = require('../../middleware/authorize');
const ctrl       = require('./alerts.controller');

const router = Router();

router.get('/',               ctrl.listUnresolved);
router.get('/all',            authorize('owner', 'cashier'), ctrl.listAll);
router.patch('/:id/resolve',  authorize('owner', 'cashier'), ctrl.resolve);

module.exports = router;
