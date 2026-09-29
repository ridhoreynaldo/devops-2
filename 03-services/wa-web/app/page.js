'use client';
import { useEffect, useState } from 'react';
import { api, STATUS_LABEL } from '../lib/api';

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const d = await api('/api/sessions');
      setSessions(d.data);
      setErr('');
    } catch (e) {
      setErr('Tidak bisa menghubungi API wa-gateway: ' + e.message);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api('/api/sessions', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
      setName('');
      await load();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const remove = async (id, nm) => {
    if (!confirm(`Hapus sesi "${nm}"? Akun WA akan di-logout.`)) return;
    try {
      await api(`/api/sessions/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) { setErr(e.message); }
  };

  const sync = async (id) => {
    try {
      const d = await api(`/api/sessions/${id}/sync-groups`, { method: 'POST' });
      alert(`Berhasil sync ${d.count} grup.`);
    } catch (e) { alert('Gagal: ' + e.message); }
  };

  return (
    <div>
      <h1>Sesi WhatsApp</h1>
      <p className="sub">Satu sesi = satu akun WA. Tambah sesi baru, lalu scan QR-nya dengan HP.</p>
      {err && <div className="err">{err}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>＋ Tambah Akun WA</h3>
        <div className="toolbar">
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label className="lbl" style={{ marginTop: 0 }}>Nama sesi (mis. "WA CS 1")</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="WA 1" />
          </div>
          <button className="btn" onClick={add} disabled={loading || !name.trim()}>
            {loading ? 'Menambah...' : 'Tambah & Minta QR'}
          </button>
        </div>
      </div>

      <div className="grid">
        {sessions.map((s) => (
          <div className="card" key={s.id}>
            <h3>{s.name}</h3>
            <p className="muted">{s.phone ? `+${s.phone}` : 'Belum terhubung ke nomor'}</p>
            <p style={{ margin: '8px 0' }}>
              <span className={`badge ${s.live}`}>{STATUS_LABEL[s.live] || s.live}</span>
            </p>
            {s.live === 'qr' && s.qr && (
              <div>
                <img className="qr-img" src={s.qr} alt="QR WhatsApp" />
                <p className="muted">Buka WA di HP → Perangkat Tertaut → Tautkan → scan QR ini.</p>
              </div>
            )}
            <div className="btn-row">
              {s.live === 'connected' && (
                <button className="btn secondary" onClick={() => sync(s.id)}>Sync Grup</button>
              )}
              <button className="btn danger" onClick={() => remove(s.id, s.name)}>Hapus</button>
            </div>
          </div>
        ))}
      </div>
      {sessions.length === 0 && !err && <p className="muted">Belum ada sesi. Tambahkan akun WA pertama di atas.</p>}
    </div>
  );
}
