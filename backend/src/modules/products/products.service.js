'use strict';

const pool           = require('../../config/db');
const { generateSKU } = require('./sku.helper');
const checkLowStock  = require('../../utils/lowStockChecker');

async function listProducts(filters = {}) {
  const conditions = ['p.is_active = TRUE'];
  const values     = [];
  let   idx        = 1;

  if (filters.category_id) { conditions.push(`p.category_id = $${idx++}`); values.push(filters.category_id); }
  if (filters.supplier_id) { conditions.push(`p.supplier_id = $${idx++}`); values.push(filters.supplier_id); }
  if (filters.size)        { conditions.push(`LOWER(p.size) = LOWER($${idx++})`); values.push(filters.size); }
  if (filters.color)       { conditions.push(`LOWER(p.color) = LOWER($${idx++})`); values.push(filters.color); }
  if (filters.search) {
    conditions.push(`(LOWER(p.name) LIKE LOWER($${idx}) OR LOWER(p.sku) LIKE LOWER($${idx}))`);
    values.push(`%${filters.search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT p.*,
            c.name AS category_name,
            s.name AS supplier_name,
            u.full_name AS created_by_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN suppliers  s ON s.id = p.supplier_id
     LEFT JOIN users      u ON u.id = p.created_by
     ${where}
     ORDER BY p.created_at DESC`,
    values
  );
  return rows;
}

async function getProductById(id) {
  const { rows } = await pool.query(
    `SELECT p.*,
            c.name AS category_name,
            s.name AS supplier_name,
            u.full_name AS created_by_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN suppliers  s ON s.id = p.supplier_id
     LEFT JOIN users      u ON u.id = p.created_by
     WHERE p.id = $1`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function getProductBySku(sku) {
  const { rows } = await pool.query(
    `SELECT p.*,
            c.name AS category_name,
            s.name AS supplier_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN suppliers  s ON s.id = p.supplier_id
     WHERE p.sku = $1 AND p.is_active = TRUE`,
    [sku]
  );
  if (!rows.length) {
    const err = new Error('Product not found for this SKU');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function createProduct(data, userId) {
  const sku = data.sku || await generateSKU();

  const { rows } = await pool.query(
    `INSERT INTO products
       (name, sku, category_id, supplier_id, size, color,
        unit_price, cost_price, quantity, low_stock_threshold,
        description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      data.name,
      sku,
      data.category_id   || null,
      data.supplier_id   || null,
      data.size          || null,
      data.color         || null,
      data.unit_price,
      data.cost_price    || null,
      data.quantity      || 0,
      data.low_stock_threshold || 5,
      data.description   || null,
      userId,
    ]
  );

  const product = rows[0];

  if (product.quantity > 0) {
    await pool.query(
      `INSERT INTO stock_movements
         (product_id, movement_type, quantity_change, quantity_before, quantity_after, performed_by, notes)
       VALUES ($1, 'stock_in', $2, 0, $2, $3, 'Initial stock on product creation')`,
      [product.id, product.quantity, userId]
    );
  }

  await checkLowStock(product.id, product.quantity, product.low_stock_threshold);

  return product;
}

async function updateProduct(id, data) {
  const allowed = [
    'name', 'category_id', 'supplier_id', 'size', 'color',
    'unit_price', 'cost_price', 'low_stock_threshold', 'description',
  ];
  const updates = [];
  const values  = [];
  let   idx     = 1;

  for (const key of allowed) {
    if (data[key] !== undefined) {
      updates.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }

  if (!updates.length) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE products SET ${updates.join(', ')} WHERE id = $${idx} AND is_active = TRUE RETURNING *`,
    values
  );
  if (!rows.length) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function adjustStock(productId, { quantity_change, notes }, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT quantity, low_stock_threshold FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [productId]
    );
    if (!rows.length) {
      const err = new Error('Product not found');
      err.status = 404;
      throw err;
    }

    const before = rows[0].quantity;
    const after  = before + quantity_change;

    if (after < 0) {
      const err = new Error(`Insufficient stock. Current: ${before}, requested change: ${quantity_change}`);
      err.status = 400;
      throw err;
    }

    await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [after, productId]);

    await client.query(
      `INSERT INTO stock_movements
         (product_id, movement_type, quantity_change, quantity_before, quantity_after, performed_by, notes)
       VALUES ($1, 'adjustment', $2, $3, $4, $5, $6)`,
      [productId, quantity_change, before, after, userId, notes || null]
    );

    await client.query('COMMIT');

    await checkLowStock(productId, after, rows[0].low_stock_threshold);

    return { product_id: productId, quantity_before: before, quantity_after: after };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function softDeleteProduct(id) {
  const { rows } = await pool.query(
    `UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING id, name, sku`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  return { message: 'Product deactivated', product: rows[0] };
}

module.exports = {
  listProducts, getProductById, getProductBySku,
  createProduct, updateProduct, adjustStock, softDeleteProduct,
};
