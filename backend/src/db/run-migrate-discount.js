'use strict';

const pool = require('../config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'sale_items' AND column_name = 'is_discounted'`
    );

    if (rows.length > 0) {
      console.log('Migration already applied — is_discounted column exists.');
      return;
    }

    await client.query(
      `ALTER TABLE sale_items
       ADD COLUMN is_discounted BOOLEAN NOT NULL DEFAULT FALSE`
    );
    console.log('Migration complete — added sale_items.is_discounted');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
