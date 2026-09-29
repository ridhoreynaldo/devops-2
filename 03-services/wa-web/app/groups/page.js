'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function GroupsPage() {
  const [sessions, setSessions] = useState([]);
  const [sid, setSid] = useState('');
  const [groups, setGroups] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/api/sessions').then((d) => {
      const conn = d.data.filter((s) => s.live === 'connected');
      setSessions(conn);
      if (conn.length) setSid(conn[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sid) return;
    api(`/api/sessions/${sid}/groups`).then((d) => setGroups(d.data)).catch(() => {});
  }, [sid]);

  const sync = async () => {
    const d = await api(`/api/sessions/${sid}/sync-groups`, { method: 'POST' });
    alert(`Berhasil sync ${d.count} grup.`);
    const g = await api(`/api/sessions/${sid}/groups`);
    setGroups(g.data);
  };

  const filtered = groups.filter((g) =>
    (g.name + g.jid).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <h1>Grup WhatsApp</h1>
      <p className="sub">Daftar grup yang diikuti tiap akun. Dipakai sebagai target broadcast.</p>
      <div className="toolbar">
        <div className="field">
          <label className="lbl" style={{ marginTop: 0 }}>Akun</label>
          <select className="select" value={sid} onChange={(e) => setSid(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.phone ? ` (+${s.phone})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl" style={{ marginTop: 0 }}>Cari</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="nama grup..." />
        </div>
        <button className="btn secondary" onClick={sync}>Sync Ulang</button>
      </div>
      <table className="tbl">
        <thead><tr><th>Nama Grup</th><th>Anggota</th><th>JID</th></tr></thead>
        <tbody>
          {filtered.map((g) => (
            <tr key={g.jid}><td>{g.name}</td><td>{g.participants}</td><td className="muted">{g.jid}</td></tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="muted" style={{ marginTop: 12 }}>Belum ada data grup. Pastikan akun terhubung lalu klik Sync Ulang.</p>}
    </div>
  );
}
