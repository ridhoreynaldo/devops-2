// Antrean kirim per sesi — mencegah ban karena spam.
// Setiap sesi punya antrean sendiri; jeda acak 3–7 detik antar pesan.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

class SendQueue {
  constructor() {
    this.queues = new Map();
    this.busy = new Set();
  }

  enqueue(sessionId, fn) {
    return new Promise((resolve, reject) => {
      if (!this.queues.has(sessionId)) this.queues.set(sessionId, []);
      this.queues.get(sessionId).push({ fn, resolve, reject });
      this.pump(sessionId);
    });
  }

  depth(sessionId) {
    return (this.queues.get(sessionId) || []).length + (this.busy.has(sessionId) ? 1 : 0);
  }

  async pump(sessionId) {
    if (this.busy.has(sessionId)) return;
    this.busy.add(sessionId);
    try {
      const q = this.queues.get(sessionId);
      while (q && q.length > 0) {
        const { fn, resolve, reject } = q.shift();
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
        if (q.length > 0) await sleep(rand(3000, 7000));
      }
    } finally {
      this.busy.delete(sessionId);
    }
  }
}

// Normalisasi target: "62812xxx" -> "62812xxx@s.whatsapp.net",
// JID grup ("...@g.us") / JID lengkap dipakai apa adanya.
function normalizeJid(target) {
  const t = String(target).trim();
  if (t.includes('@')) return t;
  const digits = t.replace(/\D/g, '');
  return digits + '@s.whatsapp.net';
}

module.exports = { SendQueue, normalizeJid };
