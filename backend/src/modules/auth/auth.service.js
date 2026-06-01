'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../../config/db');

async function login(username, password) {
  const { rows } = await pool.query(
    'SELECT id, full_name, username, password_hash, role, is_active FROM users WHERE username = $1',
    [username]
  );

  if (!rows.length) {
    const err = new Error('Invalid username or password');
    err.status = 401;
    throw err;
  }

  const user = rows[0];

  if (!user.is_active) {
    const err = new Error('Account is deactivated. Contact the owner.');
    err.status = 403;
    throw err;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const err = new Error('Invalid username or password');
    err.status = 401;
    throw err;
  }

  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return {
    token,
    user: {
      id:        user.id,
      full_name: user.full_name,
      username:  user.username,
      role:      user.role,
    },
  };
}

async function getMe(userId) {
  const { rows } = await pool.query(
    'SELECT id, full_name, username, role, is_active, created_at, last_login FROM users WHERE id = $1',
    [userId]
  );
  if (!rows.length) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

module.exports = { login, getMe };
