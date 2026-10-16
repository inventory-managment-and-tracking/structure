'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET?.trim()) {
  console.error(
    '[SERVER] JWT_SECRET is missing. Copy backend/.env.example to backend/.env and set JWT_SECRET.'
  );
  process.exit(1);
}

const app = require('./src/app');

const PREFERRED_PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_ATTEMPTS = 10;
const allowPortFallback = process.env.NODE_ENV !== 'production';
const RUNTIME_PORT_FILE = path.join(__dirname, '.runtime-port');

function listenOnAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    let attempts = 0;

    const tryListen = () => {
      const server = app.listen(port, () => {
        resolve({ server, port });
      });

      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && allowPortFallback && attempts < MAX_PORT_ATTEMPTS - 1) {
          attempts += 1;
          const blocked = port;
          port += 1;
          console.warn(`[SERVER] Port ${blocked} is in use, trying ${port}...`);
          tryListen();
          return;
        }
        reject(err);
      });
    };

    tryListen();
  });
}

function writeRuntimePort(port) {
  try {
    fs.writeFileSync(RUNTIME_PORT_FILE, String(port));
  } catch {
    // Frontend can still use its configured proxy port.
  }
}

async function start() {
  const pool = require('./src/config/db');
  try {
    await pool.query('SELECT 1');
    console.log('[DB] PostgreSQL connected successfully');
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }

  try {
    const { port } = await listenOnAvailablePort(PREFERRED_PORT);
    writeRuntimePort(port);
    console.log(`[SERVER] ClothTrack API running on http://localhost:${port}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      const last = PREFERRED_PORT + (allowPortFallback ? MAX_PORT_ATTEMPTS - 1 : 0);
      console.error(`[SERVER] No free port found from ${PREFERRED_PORT} to ${last}`);
    } else {
      console.error('[SERVER] Failed to start:', err.message);
    }
    process.exit(1);
  }
}

// Local / Railway: run as a standalone server. Vercel Services: export the app.
if (require.main === module) {
  start();
}

module.exports = app;
