'use strict';

const pool = require('../../config/db');

function dateFilter(filters, alias = 's') {
  const conds  = [];
  const values = [];
  let   idx    = 1;
  if (filters.date_from) { conds.push(`${alias}.created_at >= $${idx++}`); values.push(filters.date_from); }
  if (filters.date_to)   { conds.push(`${alias}.created_at <= $${idx++}`); values.push(filters.date_to); }
  return { conds, values, nextIdx: idx };
}

// ── Sales summary ─────────────────────────────────────────────
async function salesSummary(filters = {}) {
  const { conds, values } = dateFilter(filters);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT
       COUNT(DISTINCT s.id)::int                          AS total_sales,
       COALESCE(SUM(s.total_amount), 0)::numeric(12,2)   AS total_revenue,
       COALESCE(SUM(si.quantity), 0)::int                AS total_items_sold,
       COALESCE(AVG(s.total_amount), 0)::numeric(10,2)   AS avg_sale_value
     FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     ${where}`,
    values
  );
  return rows[0];
}

// ── Sales by employee ─────────────────────────────────────────
async function salesByEmployee(filters = {}) {
  const { conds, values } = dateFilter(filters);
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT
       u.id,
       u.full_name,
       u.username,
       COUNT(DISTINCT s.id)::int                        AS sales_count,
       COALESCE(SUM(s.total_amount), 0)::numeric(12,2) AS total_revenue,
       COALESCE(SUM(si.quantity), 0)::int               AS items_sold
     FROM users u
     LEFT JOIN sales      s  ON s.sold_by   = u.id ${where ? `AND ${conds.join(' AND ')}` : ''}
     LEFT JOIN sale_items si ON si.sale_id  = s.id
     WHERE u.role IN ('owner', 'cashier', 'sales')
     GROUP BY u.id, u.full_name, u.username
     ORDER BY total_revenue DESC`,
    values
  );
  return rows;
}

// ── Top products by sales ─────────────────────────────────────
async function salesByProduct(filters = {}) {
  const { conds, values, nextIdx } = dateFilter(filters, 's');
  const saleWhere = conds.length ? `AND ${conds.join(' AND ')}` : '';
  let   idx = nextIdx;

  const limitVal = parseInt(filters.limit, 10) || 20;
  values.push(limitVal);

  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.sku,
       p.quantity AS current_stock,
       c.name     AS category,
       COALESCE(SUM(si.quantity), 0)::int               AS total_sold,
       COALESCE(SUM(si.subtotal), 0)::numeric(12,2)     AS total_revenue
     FROM products p
     LEFT JOIN categories c  ON c.id = p.category_id
     LEFT JOIN sale_items si ON si.product_id = p.id
     LEFT JOIN sales      s  ON s.id = si.sale_id ${saleWhere}
     WHERE p.is_active = TRUE
     GROUP BY p.id, p.name, p.sku, p.quantity, c.name
     ORDER BY total_sold DESC
     LIMIT $${idx}`,
    values
  );
  return rows;
}

// ── Stock movement history (with joins) ───────────────────────
async function stockHistory(filters = {}) {
  const conds  = [];
  const values = [];
  let   idx    = 1;

  if (filters.product_id)   { conds.push(`sm.product_id = $${idx++}`);     values.push(filters.product_id); }
  if (filters.type)         { conds.push(`sm.movement_type = $${idx++}`);  values.push(filters.type); }
  if (filters.performed_by) { conds.push(`sm.performed_by = $${idx++}`);   values.push(filters.performed_by); }
  if (filters.date_from)    { conds.push(`sm.created_at >= $${idx++}`);    values.push(filters.date_from); }
  if (filters.date_to)      { conds.push(`sm.created_at <= $${idx++}`);    values.push(filters.date_to); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT
       sm.*,
       p.name      AS product_name,
       p.sku       AS product_sku,
       u.full_name AS performed_by_name
     FROM stock_movements sm
     LEFT JOIN products p ON p.id = sm.product_id
     LEFT JOIN users    u ON u.id = sm.performed_by
     ${where}
     ORDER BY sm.created_at DESC
     LIMIT 1000`,
    values
  );
  return rows;
}

// ── Stock valuation ───────────────────────────────────────────
async function stockValuation() {
  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.sku,
       p.quantity,
       p.cost_price,
       p.unit_price,
       c.name                                                      AS category,
       s.name                                                      AS supplier,
       (p.quantity * COALESCE(p.cost_price,  0))::numeric(12,2)   AS stock_cost_value,
       (p.quantity * p.unit_price)::numeric(12,2)                 AS stock_retail_value
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN suppliers  s ON s.id = p.supplier_id
     WHERE p.is_active = TRUE
     ORDER BY stock_retail_value DESC`
  );

  const { rows: totals } = await pool.query(
    `SELECT
       COALESCE(SUM(p.quantity * COALESCE(p.cost_price, 0)), 0)::numeric(12,2)  AS total_cost_value,
       COALESCE(SUM(p.quantity * p.unit_price), 0)::numeric(12,2)               AS total_retail_value,
       COALESCE(SUM(p.quantity), 0)::int                                        AS total_units
     FROM products p
     WHERE p.is_active = TRUE`
  );

  return { items: rows, summary: totals[0] };
}

// ── Returns summary ───────────────────────────────────────────
async function returnsSummary(filters = {}) {
  const conds  = [];
  const values = [];
  let   idx    = 1;

  if (filters.date_from) { conds.push(`r.created_at >= $${idx++}`); values.push(filters.date_from); }
  if (filters.date_to)   { conds.push(`r.created_at <= $${idx++}`); values.push(filters.date_to); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const [totals, byReason, byCondition, byRefund] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total_returns,
              COALESCE(SUM(refund_amount), 0)::numeric(12,2) AS total_refunded
       FROM returns r ${where}`,
      values
    ),
    pool.query(
      `SELECT reason, COUNT(*)::int AS count
       FROM returns r ${where}
       GROUP BY reason ORDER BY count DESC`,
      values
    ),
    pool.query(
      `SELECT condition, COUNT(*)::int AS count
       FROM returns r ${where}
       GROUP BY condition ORDER BY count DESC`,
      values
    ),
    pool.query(
      `SELECT refund_type, COUNT(*)::int AS count,
              COALESCE(SUM(refund_amount), 0)::numeric(12,2) AS total_amount
       FROM returns r ${where}
       GROUP BY refund_type ORDER BY count DESC`,
      values
    ),
  ]);

  return {
    summary:      totals.rows[0],
    by_reason:    byReason.rows,
    by_condition: byCondition.rows,
    by_refund:    byRefund.rows,
  };
}

// ── Daily staff activity (sales + returns per user for one day) ─
async function dailyStaffActivity(date) {
  const dateFrom = `${date} 00:00:00`;
  const dateTo   = `${date} 23:59:59`;

  const [salesRows, returnRows] = await Promise.all([
    pool.query(
      `SELECT
         u.id          AS user_id,
         u.full_name,
         u.username,
         s.id          AS sale_id,
         s.sale_code,
         s.created_at  AS sale_created_at,
         s.total_amount,
         si.quantity,
         si.unit_price,
         si.subtotal,
         p.name        AS product_name,
         p.sku         AS product_sku
       FROM sales s
       JOIN users u ON u.id = s.sold_by
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       WHERE s.created_at >= $1 AND s.created_at <= $2
       ORDER BY u.full_name, s.created_at, p.name`,
      [dateFrom, dateTo]
    ),
    pool.query(
      `SELECT
         u.id          AS user_id,
         u.full_name,
         u.username,
         r.id          AS return_id,
         r.return_code,
         r.created_at  AS return_created_at,
         r.quantity,
         r.refund_amount,
         p.name        AS product_name,
         p.sku         AS product_sku
       FROM returns r
       JOIN users u ON u.id = r.processed_by
       JOIN products p ON p.id = r.product_id
       WHERE r.created_at >= $1 AND r.created_at <= $2
       ORDER BY u.full_name, r.created_at`,
      [dateFrom, dateTo]
    ),
  ]);

  const staffMap = new Map();

  function ensureStaff(row) {
    if (!staffMap.has(row.user_id)) {
      staffMap.set(row.user_id, {
        id: row.user_id,
        full_name: row.full_name,
        username: row.username,
        sales_count: 0,
        items_sold: 0,
        total_revenue: 0,
        returns_count: 0,
        returns_qty: 0,
        total_refunded: 0,
        sales: [],
        returns: [],
        _saleIds: new Set(),
      });
    }
    return staffMap.get(row.user_id);
  }

  for (const row of salesRows.rows) {
    const staff = ensureStaff(row);
    let sale = staff.sales.find((s) => s.sale_id === row.sale_id);
    if (!sale) {
      sale = {
        sale_id: row.sale_id,
        sale_code: row.sale_code,
        created_at: row.sale_created_at,
        total_amount: row.total_amount,
        items: [],
      };
      staff.sales.push(sale);
      staff._saleIds.add(row.sale_id);
      staff.sales_count += 1;
      staff.total_revenue += parseFloat(row.total_amount || 0);
    }
    staff.items_sold += parseInt(row.quantity, 10);
    sale.items.push({
      product_name: row.product_name,
      product_sku: row.product_sku,
      quantity: row.quantity,
      unit_price: row.unit_price,
      subtotal: row.subtotal,
    });
  }

  for (const row of returnRows.rows) {
    const staff = ensureStaff(row);
    staff.returns_count += 1;
    staff.returns_qty += parseInt(row.quantity, 10);
    staff.total_refunded += parseFloat(row.refund_amount || 0);
    staff.returns.push({
      return_code: row.return_code,
      product_name: row.product_name,
      product_sku: row.product_sku,
      quantity: row.quantity,
      refund_amount: row.refund_amount,
      created_at: row.return_created_at,
    });
  }

  const staff = Array.from(staffMap.values())
    .filter((s) => s.sales_count > 0 || s.returns_count > 0)
    .map(({ _saleIds, total_revenue, total_refunded, ...rest }) => ({
      ...rest,
      total_revenue: total_revenue.toFixed(2),
      total_refunded: total_refunded.toFixed(2),
    }))
    .sort((a, b) => {
      const revDiff = parseFloat(b.total_revenue) - parseFloat(a.total_revenue);
      if (revDiff !== 0) return revDiff;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });

  return { date, staff };
}

// ── Sales trend (daily aggregation) ───────────────────────────
async function salesTrend(filters = {}) {
  const { conds, values } = dateFilter(filters, 's');
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT
       TO_CHAR(s.created_at, 'YYYY-MM-DD') AS date,
       COALESCE(SUM(s.total_amount), 0)::numeric(12,2) AS revenue,
       COUNT(DISTINCT s.id)::int AS sales_count,
       COALESCE(SUM(si.quantity), 0)::int AS items_sold
     FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     ${where}
     GROUP BY TO_CHAR(s.created_at, 'YYYY-MM-DD')
     ORDER BY date ASC`,
    values
  );
  return rows;
}

module.exports = {
  salesSummary, salesByEmployee, salesByProduct,
  stockHistory, stockValuation, returnsSummary, salesTrend,
  dailyStaffActivity,
};

