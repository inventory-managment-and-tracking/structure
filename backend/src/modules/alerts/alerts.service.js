'use strict';

const pool = require('../../config/db');

async function listUnresolved() {
  const { rows } = await pool.query(
    `SELECT a.*,
            p.name AS product_name,
            p.sku  AS product_sku,
            p.quantity AS current_quantity
     FROM low_stock_alerts a
     LEFT JOIN products p ON p.id = a.product_id
     WHERE a.is_resolved = FALSE
     ORDER BY a.alerted_at DESC`
  );
  return rows;
}

async function listAll(filters = {}) {
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (filters.product_id) { conditions.push(`a.product_id = $${idx++}`);  values.push(filters.product_id); }
  if (filters.date_from)  { conditions.push(`a.alerted_at >= $${idx++}`); values.push(filters.date_from); }
  if (filters.date_to)    { conditions.push(`a.alerted_at <= $${idx++}`); values.push(filters.date_to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT a.*,
            p.name AS product_name,
            p.sku  AS product_sku,
            p.quantity AS current_quantity
     FROM low_stock_alerts a
     LEFT JOIN products p ON p.id = a.product_id
     ${where}
     ORDER BY a.alerted_at DESC`,
    values
  );
  return rows;
}

async function resolveAlert(id) {
  const { rows } = await pool.query(
    `UPDATE low_stock_alerts
     SET is_resolved = TRUE, resolved_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Alert not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

module.exports = { listUnresolved, listAll, resolveAlert };
