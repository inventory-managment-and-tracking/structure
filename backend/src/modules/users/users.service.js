'use strict';

const bcrypt = require('bcryptjs');
const pool   = require('../../config/db');

const SAFE_FIELDS = 'id, full_name, username, role, is_active, created_at, last_login';

async function listUsers() {
  const { rows } = await pool.query(
    `SELECT ${SAFE_FIELDS} FROM users ORDER BY created_at DESC`
  );
  return rows;
}

async function getUserById(id) {
  const { rows } = await pool.query(
    `SELECT ${SAFE_FIELDS} FROM users WHERE id = $1`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function createUser({ full_name, username, password, role }) {
  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length) {
    const err = new Error(`Username "${username}" is already taken`);
    err.status = 409;
    throw err;
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (full_name, username, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SAFE_FIELDS}`,
    [full_name, username, password_hash, role || 'cashier']
  );
  return rows[0];
}

async function updateUser(id, fields) {
  const allowed = ['full_name', 'username', 'role', 'is_active'];
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
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING ${SAFE_FIELDS}`,
    values
  );

  if (!rows.length) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function resetPassword(id, newPassword) {
  const password_hash = await bcrypt.hash(newPassword, 10);
  const { rowCount } = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [password_hash, id]
  );
  if (!rowCount) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return { message: 'Password updated successfully' };
}

async function softDeleteUser(id, requestingUserId) {
  if (parseInt(id) === parseInt(requestingUserId)) {
    const err = new Error('You cannot deactivate your own account');
    err.status = 400;
    throw err;
  }
  const { rows } = await pool.query(
    `UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING ${SAFE_FIELDS}`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

module.exports = { listUsers, getUserById, createUser, updateUser, resetPassword, softDeleteUser };
