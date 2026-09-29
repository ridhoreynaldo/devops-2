// Helper fetch ke API wa-gateway.
// Kalau NEXT_PUBLIC_WA_API_URL tidak di-set, otomatis pakai
// hostname yang sama dengan port 5000 (cocok untuk akses via IP:5001).
export function apiBase() {
  if (typeof window !== 'undefined') {
    const env = process.env.NEXT_PUBLIC_WA_API_URL;
    if (env) return env.replace(/\/$/, '');
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return (process.env.NEXT_PUBLIC_WA_API_URL || 'http://localhost:5000').replace(/\/$/, '');
}

export async function api(path, opts = {}) {
  const res = await fetch(apiBase() + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export const STATUS_LABEL = {
  connected: 'Terhubung',
  qr: 'Scan QR',
  connecting: 'Menghubungkan',
  disconnected: 'Terputus',
};
