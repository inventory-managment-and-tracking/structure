'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');
const authorize  = require('../../middleware/authorize');
const ctrl       = require('./suppliers.controller');

const router = Router();

router.get('/',    ctrl.list);
router.get('/:id', ctrl.getOne);

router.post(
  '/',
  authorize('owner', 'manager'),
  [
    body('name').trim().notEmpty().withMessage('Supplier name is required'),
    body('email').optional().isEmail().withMessage('Invalid email'),
  ],
  ctrl.create
);

router.patch(
  '/:id',
  authorize('owner', 'manager'),
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
  ],
  ctrl.update
);

router.delete('/:id', authorize('owner'), ctrl.remove);

module.exports = router;
