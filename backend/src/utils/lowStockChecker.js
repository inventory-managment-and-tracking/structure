'use strict';

const pool = require('../config/db');

/**
 * After any stock decrease, check if the product has fallen at or below its
 * low_stock_threshold. If so, insert a low_stock_alerts row — but only if
 * there is no existing unresolved alert for this product already.
 *
 * @param {number} productId
 * @param {number} currentQuantity  - the quantity AFTER the change
 * @param {number} threshold        - the product's low_stock_threshold
 * @param {object} [client]         - optional pg client (for use inside transactions)
 */
async function checkLowStock(productId, currentQuantity, threshold, client) {
  if (currentQuantity > threshold) return;

  const db = client || pool;

  const { rows } = await db.query(
    `SELECT id FROM low_stock_alerts
     WHERE product_id = $1 AND is_resolved = FALSE
     LIMIT 1`,
    [productId]
  );

  if (rows.length) return;

  await db.query(
    `INSERT INTO low_stock_alerts (product_id, quantity_at_alert, threshold)
     VALUES ($1, $2, $3)`,
    [productId, currentQuantity, threshold]
  );
}

module.exports = checkLowStock;
