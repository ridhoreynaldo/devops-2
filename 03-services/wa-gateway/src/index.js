// wa-gateway v2 — entry point.
require('crypto');
global.crypto = require('crypto');

const express = require('express');
const { initDb } = require('./db');
const SessionManager = require('./sessions');
const { SendQueue } = require('./queue');
const buildRouter = require('./routes');

const PORT = Number(process.env.PORT || 5000);

async function main() {
  const db = await initDb();
  const sessions = new SessionManager(db);
  const sendQueue = new SendQueue();

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  // CORS: dashboard (port 5001) memanggil API (port 5000) beda origin.
  // Mode IP publik tanpa auth — ketatkan lagi bila sudah ada login.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.get('/', (req, res) =>
    res.json({ service: 'wa-gateway', version: '2.0.0', dashboard: 'buka wa-web (port 5001)' })
  );
  app.use(buildRouter(db, sessions, sendQueue));

  await sessions.load();

  const server = app.listen(PORT, '0.0.0.0', () =>
    console.log(`[wa-gateway] API jalan di http://0.0.0.0:${PORT}`)
  );

  const shutdown = () => {
    console.log('[wa-gateway] shutdown...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('uncaughtException', (e) => console.error('[fatal]', e.message));
  process.on('unhandledRejection', (e) => console.error('[rejection]', e?.message || e));
}

main().catch((e) => {
  console.error('[fatal] gagal start:', e.message);
  process.exit(1);
});
