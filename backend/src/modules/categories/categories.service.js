'use strict';

const pool = require('../../config/db');

async function listCategories() {
  const { rows } = await pool.query(
    `SELECT c.*, COUNT(p.id)::int AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
     GROUP BY c.id
     ORDER BY c.name`
  );
  return rows;
}

async function getCategoryById(id) {
  const { rows } = await pool.query(
    `SELECT c.*, COUNT(p.id)::int AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
     WHERE c.id = $1
     GROUP BY c.id`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Category not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function createCategory({ name, description }) {
  const { rows } = await pool.query(
    `INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *`,
    [name, description || null]
  );
  return rows[0];
}

async function updateCategory(id, { name, description }) {
  const updates = [];
  const values  = [];
  let   idx     = 1;

  if (name !== undefined)        { updates.push(`name = $${idx++}`);        values.push(name); }
  if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }

  if (!updates.length) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE categories SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!rows.length) {
    const err = new Error('Category not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function deleteCategory(id) {
  const { rows: products } = await pool.query(
    'SELECT id FROM products WHERE category_id = $1 AND is_active = TRUE LIMIT 1',
    [id]
  );
  if (products.length) {
    const err = new Error('Cannot delete category with active products. Reassign products first.');
    err.status = 409;
    throw err;
  }
  const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  if (!rowCount) {
    const err = new Error('Category not found');
    err.status = 404;
    throw err;
  }
  return { message: 'Category deleted' };
}

module.exports = { listCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
