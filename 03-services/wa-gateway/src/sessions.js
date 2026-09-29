// Manajer multi-sesi WhatsApp (satu akun WA = satu sesi = satu QR).
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const AUTH_ROOT = process.env.AUTH_ROOT || './sessions';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class SessionManager {
  constructor(db) {
    this.db = db;
    this.socks = new Map();   // id -> WASocket (hanya saat koneksi aktif)
    this.status = new Map();  // id -> 'qr' | 'connecting' | 'connected' | 'disconnected'
    this.retries = new Map(); // id -> jumlah percobaan reconnect
    fs.mkdirSync(AUTH_ROOT, { recursive: true });
  }

  // ── DB helpers ──────────────────────────────────────────────
  async setStatus(id, status, extra = {}) {
    this.status.set(id, status);
    const sets = ['status = $2', 'updated_at = now()'];
    const vals = [id, status];
    let i = 3;
    for (const [k, v] of Object.entries(extra)) {
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
    await this.db.query(`UPDATE wa_sessions SET ${sets.join(', ')} WHERE id = $1`, vals);
  }

  async list() {
    const { rows } = await this.db.query(
      'SELECT id, name, status, phone, qr, created_at, updated_at FROM wa_sessions ORDER BY created_at'
    );
    return rows.map((r) => ({ ...r, live: this.status.get(r.id) || r.status }));
  }

  connectedIds() {
    return [...this.status.entries()].filter(([, s]) => s === 'connected').map(([id]) => id);
  }

  getSock(id) {
    return this.socks.get(id);
  }

  // ── Lifecycle ───────────────────────────────────────────────
  async load() {
    const { rows } = await this.db.query("SELECT id FROM wa_sessions WHERE status <> 'deleted'");
    for (const r of rows) {
      await this.setStatus(r.id, 'connecting', { qr: null });
      this.connect(r.id).catch((e) => console.error(`[sesi ${r.id}] gagal connect awal:`, e.message));
    }
  }

  async create(name) {
    const id = 'wa-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await this.db.query('INSERT INTO wa_sessions (id, name, status) VALUES ($1, $2, $3)', [
      id,
      name || id,
      'connecting',
    ]);
    this.status.set(id, 'connecting');
    this.connect(id).catch((e) => console.error(`[sesi ${id}] gagal connect:`, e.message));
    return id;
  }

  async remove(id) {
    const sock = this.socks.get(id);
    if (sock) {
      try { await sock.logout(); } catch {}
      try { sock.ws.close(); } catch {}
      this.socks.delete(id);
    }
    this.status.delete(id);
    this.retries.delete(id);
    fs.rmSync(path.join(AUTH_ROOT, id), { recursive: true, force: true });
    await this.db.query('DELETE FROM wa_sessions WHERE id = $1', [id]);
  }

  backoff(id) {
    const n = (this.retries.get(id) || 0) + 1;
    this.retries.set(id, n);
    return Math.min(5000 * 2 ** (n - 1), 60000);
  }

  async connect(id) {
    if (this.socks.has(id)) return;
    const dir = path.join(AUTH_ROOT, id);
    fs.mkdirSync(dir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: Browsers.ubuntu('WA-Gateway'),
      connectTimeoutMs: 120000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 2000,
      maxMsgRetryCount: 3,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => ({ conversation: 'Pesan otomatis WA Gateway' }),
    });
    this.socks.set(id, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      try {
        if (qr) {
          const url = await qrcode.toDataURL(qr, { width: 320, margin: 1 });
          await this.setStatus(id, 'qr', { qr: url });
          console.log(`[sesi ${id}] QR siap, silakan scan.`);
        }
        if (connection === 'open') {
          this.retries.set(id, 0);
          const phone = sock.user?.id ? sock.user.id.split(':')[0] : null;
          await this.setStatus(id, 'connected', { phone, qr: null });
          console.log(`[sesi ${id}] terhubung${phone ? ' (' + phone + ')' : ''}.`);
          this.syncGroups(id).catch((e) => console.error(`[sesi ${id}] sync grup gagal:`, e.message));
        }
        if (connection === 'close') {
          this.socks.delete(id);
          const code = lastDisconnect?.error?.output?.statusCode;
          console.log(`[sesi ${id}] terputus (kode ${code}).`);
          if (code === DisconnectReason.loggedOut || code === 401) {
            fs.rmSync(dir, { recursive: true, force: true });
            await this.setStatus(id, 'disconnected', { phone: null, qr: null });
          } else {
            await this.setStatus(id, 'disconnected', { qr: null });
            const delay = this.backoff(id);
            setTimeout(() => this.connect(id).catch((e) => console.error(`[sesi ${id}] reconnect gagal:`, e.message)), delay);
          }
        }
      } catch (e) {
        console.error(`[sesi ${id}] error connection.update:`, e.message);
      }
    });

    // Cache grup otomatis setiap ada pesan grup masuk
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;
      for (const msg of m.messages || []) {
        const jid = msg.key?.remoteJid;
        if (!jid || !jid.endsWith('@g.us')) continue;
        try {
          const meta = await sock.groupMetadata(jid);
          await this.db.query(
            `INSERT INTO wa_groups (session_id, jid, name, participants, updated_at)
             VALUES ($1,$2,$3,$4,now())
             ON CONFLICT (session_id, jid) DO UPDATE SET name=EXCLUDED.name, participants=EXCLUDED.participants, updated_at=now()`,
            [id, jid, meta.subject || 'Tanpa Nama', meta.participants?.length || 0]
          );
        } catch {}
      }
    });
  }

  // Tarik ulang SEMUA grup yang diikuti akun ini
  async syncGroups(id) {
    const sock = this.socks.get(id);
    if (!sock) throw new Error('Sesi tidak terhubung');
    const groups = await sock.groupFetchAllParticipating();
    let n = 0;
    for (const [jid, g] of Object.entries(groups)) {
      await this.db.query(
        `INSERT INTO wa_groups (session_id, jid, name, participants, updated_at)
         VALUES ($1,$2,$3,$4,now())
         ON CONFLICT (session_id, jid) DO UPDATE SET name=EXCLUDED.name, participants=EXCLUDED.participants, updated_at=now()`,
        [id, jid, g.subject || 'Tanpa Nama', g.participants?.length || 0]
      );
      n++;
    }
    console.log(`[sesi ${id}] sync ${n} grup.`);
    return n;
  }

  async groupsOf(id) {
    const { rows } = await this.db.query(
      'SELECT jid, name, participants, updated_at FROM wa_groups WHERE session_id = $1 ORDER BY name',
      [id]
    );
    return rows;
  }
}

module.exports = SessionManager;
