// Broadcast: sebar pesan ke banyak target, digilir (round-robin)
// antar sesi WA yang dipilih — ala layanan WA profesional.
const { normalizeJid } = require('./queue');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createBroadcast(db, { name, message, sessionIds, targets, delayMs }) {
  if (!message || !String(message).trim()) throw new Error('message wajib diisi');
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) throw new Error('Pilih minimal 1 sesi');
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('Target kosong');

  const delay = Math.max(1000, Number(delayMs) || 5000);
  const { rows } = await db.query(
    `INSERT INTO wa_broadcasts (name, message, session_ids, status, delay_ms, total)
     VALUES ($1,$2,$3,'running',$4,$5) RETURNING id`,
    [name || '', message, sessionIds, delay, targets.length]
  );
  const bid = rows[0].id;

  // Bagi target secara bergilir ke sesi-sesi yang dipilih
  const values = [];
  const params = [];
  let p = 1;
  targets.forEach((t, i) => {
    values.push(`($${p++}, $${p++}, $${p++})`);
    params.push(bid, sessionIds[i % sessionIds.length], String(t));
  });
  await db.query(
    `INSERT INTO wa_broadcast_targets (broadcast_id, session_id, target) VALUES ${values.join(',')}`,
    params
  );
  return bid;
}

// Berjalan di background; progres bisa dipantau via GET /api/broadcasts/:id
async function runBroadcast(db, sessions, sendQueue, bid) {
  const get = async () => (await db.query('SELECT * FROM wa_broadcasts WHERE id = $1', [bid])).rows[0];

  for (;;) {
    const b = await get();
    if (!b || b.status !== 'running') break;

    const { rows: pending } = await db.query(
      `SELECT * FROM wa_broadcast_targets WHERE broadcast_id = $1 AND status = 'queued' ORDER BY id LIMIT 1`,
      [bid]
    );
    if (pending.length === 0) {
      await db.query(`UPDATE wa_broadcasts SET status='done', finished_at=now() WHERE id=$1`, [bid]);
      console.log(`[broadcast ${bid}] selesai.`);
      break;
    }

    const t = pending[0];
    try {
      const sock = sessions.getSock(t.session_id);
      if (!sock) throw new Error(`Sesi ${t.session_id} tidak terhubung`);
      const b2 = await get();
      await sendQueue.enqueue(t.session_id, () =>
        sock.sendMessage(normalizeJid(t.target), { text: b2.message })
      );
      await db.query(`UPDATE wa_broadcast_targets SET status='sent', sent_at=now() WHERE id=$1`, [t.id]);
      await db.query(`UPDATE wa_broadcasts SET sent = sent + 1 WHERE id=$1`, [bid]);
    } catch (e) {
      await db.query(`UPDATE wa_broadcast_targets SET status='failed', error=$2 WHERE id=$1`, [t.id, String(e.message || e).slice(0, 500)]);
      await db.query(`UPDATE wa_broadcasts SET failed = failed + 1 WHERE id=$1`, [bid]);
      console.error(`[broadcast ${bid}] gagal -> ${t.target}:`, e.message);
    }

    const b3 = await get();
    if (b3 && b3.status === 'running') await sleep(b3.delay_ms);
  }
}

module.exports = { createBroadcast, runBroadcast };
