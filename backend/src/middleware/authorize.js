'use strict';

/**
 * Role-based access guard.
 * Usage: router.delete('/:id', authorize('owner'), controller.delete)
 *        router.post('/',      authorize('owner', 'cashier'), controller.create)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }
    next();
  };
}

module.exports = authorize;
