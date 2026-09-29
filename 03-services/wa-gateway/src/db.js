// Koneksi Postgres + migrasi tabel. Tahan banting: retry sampai DB siap.
const { Pool } = require('pg');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function baseConfig() {
  return {
    host: process.env.PGHOST || 'infra_postgres',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '',
  };
}

async function withRetry(fn, label) {
  let delay = 3000;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      console.error(`[db] ${label} gagal (${e.message}), coba lagi ${delay / 1000}s...`);
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
}

async function ensureDatabase() {
  const dbName = process.env.PGDATABASE || 'wagateway';
  await withRetry(async () => {
    const admin = new Pool({ ...baseConfig(), database: 'postgres' });
    try {
      const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (rows.length === 0) {
        await admin.query(`CREATE DATABASE "${dbName}"`);
        console.log(`[db] database "${dbName}" dibuat.`);
      }
    } finally {
      await admin.end();
    }
  }, 'ensure database');
  return dbName;
}

async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_sessions (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'disconnected',
      phone      TEXT,
      qr         TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS wa_groups (
      session_id    TEXT NOT NULL REFERENCES wa_sessions(id) ON DELETE CASCADE,
      jid           TEXT NOT NULL,
      name          TEXT NOT NULL DEFAULT '',
      participants  INT  NOT NULL DEFAULT 0,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (session_id, jid)
    );
    CREATE TABLE IF NOT EXISTS wa_broadcasts (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT '',
      message     TEXT NOT NULL,
      session_ids TEXT[] NOT NULL,
      status      TEXT NOT NULL DEFAULT 'running',
      delay_ms    INT  NOT NULL DEFAULT 5000,
      total       INT  NOT NULL DEFAULT 0,
      sent        INT  NOT NULL DEFAULT 0,
      failed      INT  NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS wa_broadcast_targets (
      id           SERIAL PRIMARY KEY,
      broadcast_id INT  NOT NULL REFERENCES wa_broadcasts(id) ON DELETE CASCADE,
      session_id   TEXT NOT NULL,
      target       TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'queued',
      error        TEXT,
      sent_at      TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_wa_targets_broadcast ON wa_broadcast_targets(broadcast_id);
  `);
  console.log('[db] migrasi OK.');
}

async function initDb() {
  const dbName = await ensureDatabase();
  const pool = new Pool({ ...baseConfig(), database: dbName, max: 10 });
  await withRetry(() => migrate(pool), 'migrasi');
  // Broadcast yang masih 'running' saat restart -> tandai interrupted
  await pool.query(`UPDATE wa_broadcasts SET status='interrupted', finished_at=now() WHERE status='running'`);
  return pool;
}

module.exports = { initDb };
