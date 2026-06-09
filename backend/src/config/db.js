'use strict';

require('dotenv').config();
const { Pool } = require('pg');

function resolveConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    null
  );
}

function buildPool() {
  const connectionString = resolveConnectionString();

  if (connectionString) {
    const useSsl =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL ||
      /sslmode=require/i.test(connectionString);

    return new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  const host = process.env.DB_HOST || process.env.POSTGRES_HOST;
  const user = process.env.DB_USER || process.env.POSTGRES_USER;
  const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const database = process.env.DB_NAME || process.env.POSTGRES_DATABASE;
  const port = parseInt(
    process.env.DB_PORT || process.env.POSTGRES_PORT || '5432',
    10
  );

  if (host && user && database) {
    const useSsl = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    return new Pool({
      host,
      port,
      database,
      user,
      password,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  if (process.env.VERCEL) {
    console.error(
      '[DB] No Postgres env vars found. Link Vercel Postgres to the backend service and redeploy.'
    );
  }

  return new Pool({
    host: host || 'localhost',
    port,
    database: database || 'clothtrack',
    user: user || 'postgres',
    password: password || '1234',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

const pool = buildPool();

pool.on('error', (err) => {
  console.error('[DB] Unexpected PostgreSQL pool error:', err.message);
});

module.exports = pool;
