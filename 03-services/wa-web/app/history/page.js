'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function HistoryPage() {
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    try { setList((await api('/api/broadcasts')).data); } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const open = async (id) => {
    setDetail(await api(`/api/broadcasts/${id}`));
  };

  const cancel = async (id) => {
    if (!confirm('Batalkan broadcast ini?')) return;
    await api(`/api/broadcasts/${id}/cancel`, { method: 'POST' });
    setDetail(null);
    load();
  };

  return (
    <div>
      <h1>Riwayat Broadcast</h1>
      <p className="sub">Pantau progres & hasil tiap broadcast.</p>
      <table className="tbl">
        <thead><tr><th>ID</th><th>Nama</th><th>Status</th><th>Progres</th><th>Dibuat</th><th></th></tr></thead>
        <tbody>
          {list.map((b) => (
            <tr key={b.id}>
              <td>#{b.id}</td>
              <td>{b.name || '-'}</td>
              <td><span className={`badge ${b.status}`}>{b.status}</span></td>
              <td style={{ minWidth: 160 }}>
                {b.sent + b.failed}/{b.total} terkirim
                <div className="progress"><div style={{ width: `${b.total ? Math.round(((b.sent + b.failed) / b.total) * 100) : 0}%` }} /></div>
              </td>
              <td className="muted">{new Date(b.created_at).toLocaleString('id-ID')}</td>
              <td><button className="btn secondary" style={{ padding: '6px 12px' }} onClick={() => open(b.id)}>Detail</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {detail && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>Broadcast #{detail.data.id} {detail.data.name && `— ${detail.data.name}`}</h3>
          <p style={{ margin: '8px 0' }}>
            <span className={`badge ${detail.data.status}`}>{detail.data.status}</span>{' '}
            <span className="muted">{detail.data.sent} terkirim, {detail.data.failed} gagal dari {detail.data.total}</span>
          </p>
          {detail.data.status === 'running' && (
            <div className="btn-row"><button className="btn danger" onClick={() => cancel(detail.data.id)}>Batalkan</button></div>
          )}
          <table className="tbl" style={{ marginTop: 12 }}>
            <thead><tr><th>Target</th><th>Akun</th><th>Status</th><th>Keterangan</th></tr></thead>
            <tbody>
              {detail.targets.map((t, i) => (
                <tr key={i}>
                  <td className="muted">{t.target}</td>
                  <td className="muted">{t.session_id}</td>
                  <td><span className={`badge ${t.status === 'sent' ? 'done' : t.status === 'failed' ? 'failed' : 'running'}`}>{t.status}</span></td>
                  <td className="muted">{t.error || (t.sent_at ? new Date(t.sent_at).toLocaleTimeString('id-ID') : '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="btn-row"><button className="btn secondary" onClick={() => setDetail(null)}>Tutup</button></div>
        </div>
      )}
    </div>
  );
}
