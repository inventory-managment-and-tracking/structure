'use strict';

const pool          = require('../../config/db');
const checkLowStock = require('../../utils/lowStockChecker');

function generateSaleCode() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SALE-${date}-${rand}`;
}

/**
 * Creates a complete sale in a single atomic transaction:
 *  1. INSERT sales
 *  2. For each item: lock product row, validate stock, INSERT sale_items,
 *     UPDATE products.quantity, INSERT stock_movements
 *  3. After COMMIT: check low-stock alerts for each affected product
 */
async function createSale({ items, payment_method, notes }, userId) {
  if (!items || !items.length) {
    const err = new Error('Sale must contain at least one item');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sale_code = generateSaleCode();

    const { rows: saleRows } = await client.query(
      `INSERT INTO sales (sale_code, sold_by, payment_method, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sale_code`,
      [sale_code, userId, payment_method || 'cash', notes || null]
    );
    const sale_id = saleRows[0].id;

    let total_amount = 0;
    const stockUpdates = [];

    for (const item of items) {
      const { rows: productRows } = await client.query(
        `SELECT id, name, quantity, unit_price, low_stock_threshold
         FROM products
         WHERE id = $1 AND is_active = TRUE
         FOR UPDATE`,
        [item.product_id]
      );

      if (!productRows.length) {
        throw Object.assign(
          new Error(`Product ID ${item.product_id} not found or inactive`),
          { status: 404 }
        );
      }

      const product  = productRows[0];
      const qty      = parseInt(item.quantity, 10);
      const catalogPrice = parseFloat(product.unit_price);
      const catalogLineTotal = parseFloat((catalogPrice * qty).toFixed(2));

      let price;
      let subtotal;
      if (item.subtotal != null && item.subtotal !== '') {
        subtotal = parseFloat(parseFloat(item.subtotal).toFixed(2));
        price = parseFloat((subtotal / qty).toFixed(2));
      } else {
        price = parseFloat(item.unit_price ?? product.unit_price);
        subtotal = parseFloat((qty * price).toFixed(2));
      }

      const isDiscounted = subtotal < catalogLineTotal;

      if (qty <= 0) {
        throw Object.assign(new Error('Item quantity must be > 0'), { status: 400 });
      }

      if (product.quantity < qty) {
        throw Object.assign(
          new Error(`Insufficient stock for "${product.name}". Available: ${product.quantity}, requested: ${qty}`),
          { status: 400 }
        );
      }

      const qty_before = product.quantity;
      const qty_after  = qty_before - qty;

      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal, is_discounted)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sale_id, item.product_id, qty, price, subtotal, isDiscounted]
      );

      await client.query(
        'UPDATE products SET quantity = $1 WHERE id = $2',
        [qty_after, item.product_id]
      );

      await client.query(
        `INSERT INTO stock_movements
           (product_id, movement_type, quantity_change, quantity_before, quantity_after,
            unit_price, sale_id, performed_by)
         VALUES ($1, 'sale', $2, $3, $4, $5, $6, $7)`,
        [item.product_id, -qty, qty_before, qty_after, price, sale_id, userId]
      );

      total_amount += subtotal;
      stockUpdates.push({
        product_id: item.product_id,
        qty_after,
        threshold: product.low_stock_threshold,
      });
    }

    total_amount = parseFloat(total_amount.toFixed(2));
    await client.query('UPDATE sales SET total_amount = $1 WHERE id = $2', [total_amount, sale_id]);

    await client.query('COMMIT');

    for (const upd of stockUpdates) {
      await checkLowStock(upd.product_id, upd.qty_after, upd.threshold);
    }

    return getSaleById(sale_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listSales(filters = {}) {
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (filters.sold_by)        { conditions.push(`s.sold_by = $${idx++}`);           values.push(filters.sold_by); }
  if (filters.payment_method) { conditions.push(`s.payment_method = $${idx++}`);    values.push(filters.payment_method); }
  if (filters.date_from)      { conditions.push(`s.created_at >= $${idx++}`);       values.push(filters.date_from); }
  if (filters.date_to)        { conditions.push(`s.created_at <= $${idx++}`);       values.push(filters.date_to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT s.*,
            u.full_name AS sold_by_name,
            COUNT(si.id)::int AS item_count
     FROM sales s
     LEFT JOIN users      u  ON u.id = s.sold_by
     LEFT JOIN sale_items si ON si.sale_id = s.id
     ${where}
     GROUP BY s.id, u.full_name
     ORDER BY s.created_at DESC`,
    values
  );
  return rows;
}

async function getSaleById(id) {
  const { rows: saleRows } = await pool.query(
    `SELECT s.*,
            u.full_name AS sold_by_name
     FROM sales s
     LEFT JOIN users u ON u.id = s.sold_by
     WHERE s.id = $1`,
    [id]
  );
  if (!saleRows.length) {
    const err = new Error('Sale not found');
    err.status = 404;
    throw err;
  }

  const { rows: items } = await pool.query(
    `SELECT si.*,
            p.name AS product_name,
            p.sku  AS product_sku
     FROM sale_items si
     LEFT JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = $1`,
    [id]
  );

  return { ...saleRows[0], items };
}

module.exports = { createSale, listSales, getSaleById };
