'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function BroadcastPage() {
  const [sessions, setSessions] = useState([]);
  const [selSessions, setSelSessions] = useState([]);
  const [groupsBy, setGroupsBy] = useState({}); // sessionId -> groups[]
  const [targets, setTargets] = useState([]);   // jid[]
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [delayMs, setDelayMs] = useState(8000);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    api('/api/sessions').then(async (d) => {
      const conn = d.data.filter((s) => s.live === 'connected');
      setSessions(conn);
      const map = {};
      for (const s of conn) {
        try { map[s.id] = (await api(`/api/sessions/${s.id}/groups`)).data; }
        catch { map[s.id] = []; }
      }
      setGroupsBy(map);
    }).catch((e) => setErr(e.message));
  }, []);

  const toggle = (arr, setArr, v) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const toggleAllGroups = (sid) => {
    const jids = (groupsBy[sid] || []).map((g) => g.jid);
    const allIn = jids.every((j) => targets.includes(j));
    setTargets(allIn ? targets.filter((t) => !jids.includes(t)) : [...new Set([...targets, ...jids])]);
  };

  const submit = async () => {
    setErr(''); setOk('');
    try {
      const d = await api('/api/broadcasts', {
        method: 'POST',
        body: JSON.stringify({ name, message, sessionIds: selSessions, targets, delayMs }),
      });
      setOk(`Broadcast #${d.id} mulai jalan (${targets.length} target, ${selSessions.length} akun bergiliran). Pantau di menu Riwayat.`);
      setTargets([]); setMessage(''); setName('');
    } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <h1>Broadcast</h1>
      <p className="sub">Kirim satu pesan ke banyak grup/nomor. Target dibagi bergiliran ke akun-akun terpilih biar tidak kena ban.</p>
      {err && <div className="err">{err}</div>}
      {ok && <div className="ok">{ok}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="lbl" style={{ marginTop: 0 }}>Nama broadcast (opsional)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo Oktober" />

        <label className="lbl">1. Pilih akun pengirim (bergiliran)</label>
        {sessions.map((s) => (
          <label className="check-row" key={s.id}>
            <input type="checkbox" checked={selSessions.includes(s.id)} onChange={() => toggle(selSessions, setSelSessions, s.id)} />
            {s.name}{s.phone ? ` (+${s.phone})` : ''}
          </label>
        ))}
        {sessions.length === 0 && <p className="muted">Belum ada akun terhubung.</p>}

        <label className="lbl">2. Pilih target grup</label>
        {selSessions.map((sid) => (
          <div key={sid} style={{ marginBottom: 8 }}>
            <p style={{ fontWeight: 700, fontSize: 14, margin: '8px 0 4px' }}>
              {sessions.find((s) => s.id === sid)?.name}{' '}
              <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleAllGroups(sid)}>
                Pilih semua
              </button>
            </p>
            {(groupsBy[sid] || []).map((g) => (
              <label className="check-row" key={g.jid}>
                <input type="checkbox" checked={targets.includes(g.jid)} onChange={() => toggle(targets, setTargets, g.jid)} />
                {g.name} <span className="muted">({g.participants} anggota)</span>
              </label>
            ))}
          </div>
        ))}

        <label className="lbl">3. Isi pesan</label>
        <textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tulis pesan broadcast..." />

        <label className="lbl">4. Jeda antar pesan (detik)</label>
        <input className="input" type="number" min="3" value={delayMs / 1000} onChange={(e) => setDelayMs(Number(e.target.value) * 1000)} style={{ maxWidth: 160 }} />
        <p className="muted" style={{ marginTop: 4 }}>Disarankan ≥ 8 detik untuk menghindari pemblokiran WhatsApp.</p>

        <div className="btn-row">
          <button className="btn" onClick={submit} disabled={!message.trim() || !selSessions.length || !targets.length}>
            🚀 Mulai Broadcast ({targets.length} target)
          </button>
        </div>
      </div>
    </div>
  );
}
