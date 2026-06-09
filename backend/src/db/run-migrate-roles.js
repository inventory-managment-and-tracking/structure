'use strict';

const pool = require('../config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT enumlabel FROM pg_enum
       JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
       WHERE pg_type.typname = 'user_role'
       ORDER BY enumsortorder`
    );
    const values = rows.map((r) => r.enumlabel);
    console.log('Current user_role values:', values.join(', '));

    if (values.includes('sales')) {
      console.log('Migration already applied — nothing to do.');
      return;
    }

    if (!values.includes('manager') || !values.includes('cashier')) {
      throw new Error(`Unexpected enum values: ${values.join(', ')}`);
    }

    await client.query("ALTER TYPE user_role RENAME VALUE 'cashier' TO 'sales'");
    await client.query("ALTER TYPE user_role RENAME VALUE 'manager' TO 'cashier'");

    const { rows: after } = await client.query(
      `SELECT enumlabel FROM pg_enum
       JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
       WHERE pg_type.typname = 'user_role'
       ORDER BY enumsortorder`
    );
    console.log('Migration complete. New values:', after.map((r) => r.enumlabel).join(', '));
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
