'use strict';

const pool = require('../../config/db');

async function listMovements(filters = {}) {
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (filters.product_id)   { conditions.push(`sm.product_id = $${idx++}`);     values.push(filters.product_id); }
  if (filters.type)         { conditions.push(`sm.movement_type = $${idx++}`);  values.push(filters.type); }
  if (filters.performed_by) { conditions.push(`sm.performed_by = $${idx++}`);   values.push(filters.performed_by); }
  if (filters.date_from)    { conditions.push(`sm.created_at >= $${idx++}`);    values.push(filters.date_from); }
  if (filters.date_to)      { conditions.push(`sm.created_at <= $${idx++}`);    values.push(filters.date_to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT sm.*,
            p.name  AS product_name,
            p.sku   AS product_sku,
            u.full_name AS performed_by_name
     FROM stock_movements sm
     LEFT JOIN products p ON p.id = sm.product_id
     LEFT JOIN users    u ON u.id = sm.performed_by
     ${where}
     ORDER BY sm.created_at DESC
     LIMIT 500`,
    values
  );
  return rows;
}

async function listMovementsForProduct(productId) {
  const { rows } = await pool.query(
    `SELECT sm.*,
            u.full_name AS performed_by_name
     FROM stock_movements sm
     LEFT JOIN users u ON u.id = sm.performed_by
     WHERE sm.product_id = $1
     ORDER BY sm.created_at DESC`,
    [productId]
  );
  return rows;
}

module.exports = { listMovements, listMovementsForProduct };
