const crypto = require('crypto');
global.crypto = crypto;

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode  = require('qrcode');
const pino    = require('pino');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

// ─── Global State ─────────────────────────────────────────────
let sock           = null;
let isConnected    = false;
let currentQR      = '';
let reconnectDelay = 5_000;
const MAX_DELAY    = 60_000;
const MAX_QUEUE    = 50;
const messageQueue = [];
let isProcessing   = false;

// ─── Setup Penyimpanan Grup (Biar Gak Lemot & Permanen) ───────
const GROUPS_FILE = './groups.json';
let savedGroups = {};

// Load data grup yang sudah pernah tersimpan saat server nyala
if (fs.existsSync(GROUPS_FILE)) {
  try {
    savedGroups = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
  } catch (e) {
    savedGroups = {};
  }
}

// Fungsi simpan grup baru
function saveNewGroup(jid, name) {
  if (!savedGroups[jid]) {
    savedGroups[jid] = name;
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(savedGroups, null, 2));
    console.log(`[GRUP BARU DISIMPAN] Nama: ${name} | ID: ${jid}`);
  }
}

// ─── Express Setup ────────────────────────────────────────────
const app    = express();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });
app.use(express.json());

// ─── Hapus Sesi ───────────────────────────────────────────────
function clearAuthFolder() {
  const dir = './auth_info_baileys';
  if (fs.existsSync(dir)) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        fs.rmSync(path.join(dir, file), { recursive: true, force: true });
      }
      console.log('Sesi berhasil dibersihkan.');
    } catch (e) {
      console.error('Gagal membersihkan sesi:', e.message);
    }
  }
}

// ─── Dashboard HTML ───────────────────────────────────────────
const dashboardHTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WA Gateway Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; width: 380px; }
    .card h2 { margin-top: 0; color: #111; font-size: 20px; margin-bottom: 8px; }
    img { max-width: 250px; margin: 20px 0; border-radius: 8px; }
    .status { font-size: 1.1em; font-weight: 600; margin-top: 10px; }
    .connected { color: #25D366; } .disconnected { color: #ef4444; } .connecting { color: #f59e0b; }
    .stats { margin-top: 16px; font-size: 13px; color: #6b7280; border-top: 1px solid #f0f0f0; padding-top: 14px; display: flex; justify-content: space-between; }
    .logout-btn { margin-top: 16px; padding: 10px 15px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: none; width: 100%; transition: .2s; }
    .logout-btn:hover { background: #dc2626; }
    .nav-btn { margin-top: 10px; padding: 10px 15px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%; text-decoration: none; display: block; transition: .2s; }
    .nav-btn:hover { background: #2563eb; }
    .dot-live { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #25D366; margin-right: 4px; animation: blink 1.5s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
  </style>
</head>
<body>
  <div class="card">
    <h2>WA Gateway Asrama (Lite)</h2>
    <div id="qr-container"><p style="color:#9ca3af;padding:20px 0;">Memuat sistem...</p></div>
    <div id="status" class="status">Memeriksa status...</div>
    <div class="stats">
      <span>Antrean: <b id="q-len">0</b></span>
      <span>Grup Tersimpan: <b id="grp-len">0</b></span>
      <span>Uptime: <b id="uptime">-</b></span>
    </div>
    <a href="/api/groups" target="_blank" class="nav-btn">Lihat Data Grup Tersimpan</a>
    <button id="logout-btn" class="logout-btn">Logout WhatsApp</button>
  </div>
  <script>
    function formatUptime(s) { var h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60); return h+'j '+m+'m '+sec+'d'; }
    async function fetchStatus() {
      try {
        var res = await fetch('/api/status'), data = await res.json();
        var qrC = document.getElementById('qr-container'), st = document.getElementById('status'), lb = document.getElementById('logout-btn');
        document.getElementById('q-len').textContent = data.queueLength;
        document.getElementById('grp-len').textContent = data.totalGroups;
        document.getElementById('uptime').textContent = formatUptime(data.uptime);
        if (data.isConnected) {
          qrC.innerHTML = '<div style="font-size:52px;margin:16px 0">&#127881;</div><p style="color:#25D366;font-weight:600;">WhatsApp siap digunakan!</p>';
          st.innerHTML = '<span class="connected">Terhubung</span>'; lb.style.display = 'block';
        } else if (data.qr) {
          qrC.innerHTML = '<img src="'+data.qr+'" alt="QR Code">';
          st.innerHTML = '<span class="disconnected">Scan QR untuk terhubung</span>'; lb.style.display = 'none';
        } else {
          qrC.innerHTML = '<p style="color:#f59e0b;padding:20px 0;">Menghubungkan...</p>';
          st.innerHTML = '<span class="connecting">Mohon tunggu...</span>'; lb.style.display = 'none';
        }
      } catch(e) {}
    }
    document.getElementById('logout-btn').addEventListener('click', async function() {
      if (confirm('Yakin ingin logout? Sistem akan restart.')) {
        this.textContent = 'Memproses...'; await fetch('/api/logout', { method: 'POST' }); alert('Sistem sedang restart...');
      }
    });
    setInterval(fetchStatus, 3000); fetchStatus();
  </script>
</body>
</html>`;

// ─── Routes ───────────────────────────────────────────────────
app.get('/', (req, res) => res.send(dashboardHTML));

// Endpoint untuk melihat list Grup ID
app.get('/api/groups', (req, res) => {
  res.json({ total: Object.keys(savedGroups).length, data: savedGroups });
});

// ─── API Status ───────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ 
    isConnected, 
    qr: currentQR, 
    queueLength: messageQueue.length, 
    totalGroups: Object.keys(savedGroups).length,
    uptime: process.uptime() 
  });
});

app.post('/api/logout', async (req, res) => {
  if (sock) { try { await sock.logout(); } catch (e) {} }
  clearAuthFolder();
  res.json({ status: 'success' });
  setTimeout(() => { process.exit(1); }, 1000);
});

// ─── Endpoint Kirim Pesan ─────────────────────────────────────
app.post('/send-wa', (req, res) => {
  const { target, message } = req.body;
  if (!target || !message) return res.status(400).json({ status: 'error', message: 'target dan message wajib diisi' });
  enqueue({ type: 'text', target, message }, res);
});

app.post('/send-document', upload.single('file'), (req, res) => {
  const { target, caption } = req.body;
  const file = req.file;
  if (!file)   return res.status(400).json({ status: 'error', message: 'Tidak ada file' });
  if (!target) return res.status(400).json({ status: 'error', message: 'target wajib diisi' });
  enqueue({ type: 'document', target, caption, buffer: Buffer.from(file.buffer), filename: file.originalname || 'Laporan.pdf' }, res);
});

// ─── Queue Logic ──────────────────────────────────────────────
function enqueue(job, res) {
  if (messageQueue.length >= MAX_QUEUE) return res.status(429).json({ status: 'error', message: 'Queue penuh' });
  messageQueue.push({ job, res });
  processQueue();
}

async function processQueue() {
  if (isProcessing || messageQueue.length === 0) return;
  isProcessing = true;
  while (messageQueue.length > 0) {
    if (!isConnected) {
      await sleep(3_000);
      if (!isConnected) {
        const { res } = messageQueue.shift();
        res.status(503).json({ status: 'error', message: 'WA tidak terhubung' });
        continue;
      }
    }
    const { job, res } = messageQueue.shift();
    try {
      await sendMessage(job);
      res.status(200).json({ status: 'success' });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
    await sleep(2000);
  }
  isProcessing = false;
}

async function sendMessage(job) {
  const id = job.target.includes('@') ? job.target : job.target + '@s.whatsapp.net';
  if (job.type === 'text') {
    await sock.sendMessage(id, { text: job.message });
  } else if (job.type === 'document') {
    await sock.sendMessage(id, { document: job.buffer, mimetype: 'application/pdf', fileName: job.filename, caption: job.caption || '' });
  }
}

// ─── WA Connection ────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version }          = await fetchLatestBaileysVersion();
  const logger               = pino({ level: 'silent' });

  sock = makeWASocket({
    version,
    logger,
    printQRInTerminal              : false,
    auth                           : { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    browser                        : Browsers.ubuntu('Chrome'),
    connectTimeoutMs               : 120_000,
    keepAliveIntervalMs            : 30_000,
    retryRequestDelayMs            : 2_000,
    maxMsgRetryCount               : 3,
    markOnlineOnConnect            : false,
    generateHighQualityLinkPreview : false,
    getMessage                     : async () => ({ conversation: 'Laporan Asrama Otomatis' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) qrcode.toDataURL(qr, (err, url) => { if (!err) currentQR = url; });
    if (connection === 'open') {
      isConnected    = true;
      currentQR      = '';
      reconnectDelay = 5_000;
      console.log('WhatsApp terhubung!');
      processQueue();
    }
    if (connection === 'close') {
      isConnected = false;
      currentQR   = '';
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('Koneksi terputus, kode:', reason);
      if (reason === DisconnectReason.loggedOut || reason === 401) { clearAuthFolder(); process.exit(1); }
      setTimeout(connectToWhatsApp, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
    }
  });

  // ─── Listener Super Ringan: Hanya Tangkap Grup ID ───────────
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      if (!msg.key || !msg.key.remoteJid) continue;
      
      const jid = msg.key.remoteJid;
      
      // Filter: Hanya peduli jika pesan datang dari Grup DAN grup tersebut belum ada di database kita
      if (jid.endsWith('@g.us') && !savedGroups[jid]) {
        try {
          // Ambil nama asli grup dari server WA (karena msg.pushName itu nama pengirim, bukan nama grup)
          const metadata = await sock.groupMetadata(jid);
          saveNewGroup(jid, metadata.subject || 'Grup Tanpa Nama');
        } catch (error) {
          // Jika gagal fetch metadata, simpan sementara dengan nama Unknown agar tidak me-request terus menerus
          saveNewGroup(jid, 'Grup Unknown');
        }
      }
    }
  });
}

// ─── Graceful Shutdown ────────────────────────────────────────
const gracefulShutdown = async () => {
  if (sock) { 
      try { sock.ws.close(); } catch(e) {} 
  }
  process.exit(0);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT',  gracefulShutdown);
process.on('uncaughtException',  (err)    => console.error('Uncaught:', err.message));
process.on('unhandledRejection', (reason) => console.error('Rejection:', reason));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

connectToWhatsApp().catch(console.error);

// ─── Perbaikan Port ───────────────────────────────────────────
app.listen(5000, '0.0.0.0', () => {
  console.log('WA Gateway (Lite) jalan di http://localhost:5000');
  console.log('Lihat Data Grup di http://localhost:5000/api/groups');
});