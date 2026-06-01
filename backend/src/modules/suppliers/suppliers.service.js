'use strict';

const pool = require('../../config/db');

async function listSuppliers() {
  const { rows } = await pool.query(
    `SELECT s.*, COUNT(p.id)::int AS product_count
     FROM suppliers s
     LEFT JOIN products p ON p.supplier_id = s.id AND p.is_active = TRUE
     GROUP BY s.id
     ORDER BY s.name`
  );
  return rows;
}

async function getSupplierById(id) {
  const { rows } = await pool.query(
    `SELECT s.*, COUNT(p.id)::int AS product_count
     FROM suppliers s
     LEFT JOIN products p ON p.supplier_id = s.id AND p.is_active = TRUE
     WHERE s.id = $1
     GROUP BY s.id`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Supplier not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function createSupplier({ name, phone, email, address, notes }) {
  const { rows } = await pool.query(
    `INSERT INTO suppliers (name, phone, email, address, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, phone || null, email || null, address || null, notes || null]
  );
  return rows[0];
}

async function updateSupplier(id, fields) {
  const allowed = ['name', 'phone', 'email', 'address', 'notes'];
  const updates = [];
  const values  = [];
  let   idx     = 1;

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = $${idx++}`);
      values.push(fields[key]);
    }
  }

  if (!updates.length) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE suppliers SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!rows.length) {
    const err = new Error('Supplier not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function deleteSupplier(id) {
  const { rows: active } = await pool.query(
    'SELECT id FROM products WHERE supplier_id = $1 AND is_active = TRUE LIMIT 1',
    [id]
  );
  if (active.length) {
    const err = new Error('Cannot delete supplier with active products. Reassign products first.');
    err.status = 409;
    throw err;
  }
  const { rowCount } = await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
  if (!rowCount) {
    const err = new Error('Supplier not found');
    err.status = 404;
    throw err;
  }
  return { message: 'Supplier deleted' };
}

module.exports = { listSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier };
