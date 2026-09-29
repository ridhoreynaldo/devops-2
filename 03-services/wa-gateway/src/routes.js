// Semua endpoint REST wa-gateway v2.
const express = require('express');
const multer = require('multer');
const { normalizeJid } = require('./queue');
const { createBroadcast, runBroadcast } = require('./broadcast');

const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

function buildRouter(db, sessions, sendQueue) {
  const r = express.Router();

  const needSession = (id) => {
    const sock = sessions.getSock(id);
    if (!sock) {
      const e = new Error(`Sesi ${id} tidak terhubung`);
      e.status = 503;
      throw e;
    }
    return sock;
  };

  // ── Info ────────────────────────────────────────────────────
  r.get('/api/health', (req, res) => res.json({ ok: true, sessions: sessions.connectedIds().length }));

  // ── Sesi ────────────────────────────────────────────────────
  r.get('/api/sessions', async (req, res, next) => {
    try { res.json({ data: await sessions.list() }); } catch (e) { next(e); }
  });

  r.post('/api/sessions', async (req, res, next) => {
    try {
      const id = await sessions.create(req.body?.name);
      res.status(201).json({ id });
    } catch (e) { next(e); }
  });

  r.delete('/api/sessions/:id', async (req, res, next) => {
    try {
      await sessions.remove(req.params.id);
      res.json({ status: 'success' });
    } catch (e) { next(e); }
  });

  r.get('/api/sessions/:id/groups', async (req, res, next) => {
    try { res.json({ data: await sessions.groupsOf(req.params.id) }); } catch (e) { next(e); }
  });

  r.post('/api/sessions/:id/sync-groups', async (req, res, next) => {
    try {
      const count = await sessions.syncGroups(req.params.id);
      res.json({ status: 'success', count });
    } catch (e) { next(e); }
  });

  // ── Kirim pesan (multi-session) ─────────────────────────────
  r.post('/api/send', async (req, res, next) => {
    try {
      const { sessionId, target, message } = req.body || {};
      if (!sessionId || !target || !message) {
        return res.status(400).json({ status: 'error', message: 'sessionId, target, message wajib diisi' });
      }
      const sock = needSession(sessionId);
      await sendQueue.enqueue(sessionId, () =>
        sock.sendMessage(normalizeJid(target), { text: message })
      );
      res.json({ status: 'success', sessionId });
    } catch (e) { next(e); }
  });

  r.post('/api/send-document', upload.single('file'), async (req, res, next) => {
    try {
      const { sessionId, target, caption } = req.body || {};
      if (!sessionId || !target || !req.file) {
        return res.status(400).json({ status: 'error', message: 'sessionId, target, dan file wajib diisi' });
      }
      const sock = needSession(sessionId);
      await sendQueue.enqueue(sessionId, () =>
        sock.sendMessage(normalizeJid(target), {
          document: req.file.buffer,
          mimetype: req.file.mimetype || 'application/pdf',
          fileName: req.file.originalname || 'dokumen',
          caption: caption || '',
        })
      );
      res.json({ status: 'success', sessionId });
    } catch (e) { next(e); }
  });

  // ── Broadcast ───────────────────────────────────────────────
  r.post('/api/broadcasts', async (req, res, next) => {
    try {
      const { name, message, sessionIds, targets, delayMs } = req.body || {};
      const bad = (sessionIds || []).filter((id) => !sessions.getSock(id));
      if (bad.length > 0) {
        return res.status(400).json({ status: 'error', message: `Sesi belum terhubung: ${bad.join(', ')}` });
      }
      const id = await createBroadcast(db, { name, message, sessionIds, targets, delayMs });
      runBroadcast(db, sessions, sendQueue, id).catch((e) =>
        console.error(`[broadcast ${id}] fatal:`, e.message)
      );
      res.status(201).json({ id });
    } catch (e) { next(e); }
  });

  r.get('/api/broadcasts', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        'SELECT id, name, session_ids, status, delay_ms, total, sent, failed, created_at, finished_at FROM wa_broadcasts ORDER BY id DESC LIMIT 50'
      );
      res.json({ data: rows });
    } catch (e) { next(e); }
  });

  r.get('/api/broadcasts/:id', async (req, res, next) => {
    try {
      const { rows } = await db.query('SELECT * FROM wa_broadcasts WHERE id = $1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ status: 'error', message: 'Tidak ditemukan' });
      const targets = (await db.query(
        'SELECT session_id, target, status, error, sent_at FROM wa_broadcast_targets WHERE broadcast_id = $1 ORDER BY id',
        [req.params.id]
      )).rows;
      res.json({ data: rows[0], targets });
    } catch (e) { next(e); }
  });

  r.post('/api/broadcasts/:id/cancel', async (req, res, next) => {
    try {
      await db.query(`UPDATE wa_broadcasts SET status='cancelled', finished_at=now() WHERE id=$1 AND status='running'`, [req.params.id]);
      res.json({ status: 'success' });
    } catch (e) { next(e); }
  });

  // ── Kompatibilitas: endpoint lama v1 ─────────────────────────
  // POST /send-wa { target, message, sessionId? } — tanpa sessionId
  // berarti pakai sesi pertama yang sedang terhubung.
  async function defaultSession() {
    const ids = sessions.connectedIds();
    if (!ids.length) {
      const e = new Error('Tidak ada sesi WA yang terhubung');
      e.status = 503;
      throw e;
    }
    return ids[0];
  }

  r.post('/send-wa', async (req, res, next) => {
    try {
      const { target, message, sessionId } = req.body || {};
      if (!target || !message) return res.status(400).json({ status: 'error', message: 'target dan message wajib diisi' });
      const sid = sessionId || (await defaultSession());
      const sock = needSession(sid);
      await sendQueue.enqueue(sid, () => sock.sendMessage(normalizeJid(target), { text: message }));
      res.json({ status: 'success', sessionId: sid });
    } catch (e) { next(e); }
  });

  r.post('/send-document', upload.single('file'), async (req, res, next) => {
    try {
      const { target, caption, sessionId } = req.body || {};
      if (!target || !req.file) return res.status(400).json({ status: 'error', message: 'target dan file wajib diisi' });
      const sid = sessionId || (await defaultSession());
      const sock = needSession(sid);
      await sendQueue.enqueue(sid, () =>
        sock.sendMessage(normalizeJid(target), {
          document: req.file.buffer,
          mimetype: req.file.mimetype || 'application/pdf',
          fileName: req.file.originalname || 'dokumen',
          caption: caption || '',
        })
      );
      res.json({ status: 'success', sessionId: sid });
    } catch (e) { next(e); }
  });

  // ── Error handler ───────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  r.use((err, req, res, next) => {
    console.error('[api]', err.message);
    res.status(err.status || 500).json({ status: 'error', message: err.message || 'Kesalahan server' });
  });

  return r;
}

module.exports = buildRouter;
