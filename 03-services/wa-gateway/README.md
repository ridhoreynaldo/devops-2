# WA Gateway v2 — Multi-Session + Broadcast

Layanan WhatsApp profesional berbasis Baileys:
- **Banyak akun WA** — tiap akun = 1 sesi dengan QR sendiri (`POST /api/sessions`)
- **Dashboard Next.js** (`wa-web`, port 5001): kelola sesi, lihat grup, broadcast, riwayat
- **Broadcast bergiliran** — target dibagi round-robin ke akun-akun terpilih + jeda acak antar pesan (anti-ban)
- **Postgres** — sesi, cache grup, broadcast & log tersimpan permanen
- **Kompatibel** — endpoint lama `POST /send-wa` & `POST /send-document` tetap jalan
  (tanpa `sessionId` = pakai akun pertama yang terhubung)

## Arsitektur

```
wa-web (Next.js :5001) ──HTTP──> wa-gateway (Express :5000) ──WS──> WhatsApp
                                          │
                                          └──> Postgres (infra_postgres:5432, db wagateway)
Sesi auth tersimpan di ./sessions/<session-id>/ (di-ignore git)
```

## API

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek hidup |
| GET/POST | `/api/sessions` | List / tambah sesi (balikan QR di `qr`) |
| DELETE | `/api/sessions/:id` | Logout + hapus sesi |
| GET | `/api/sessions/:id/groups` | Grup dari cache DB |
| POST | `/api/sessions/:id/sync-groups` | Tarik ulang semua grup dari WA |
| POST | `/api/send` | `{sessionId, target, message}` |
| POST | `/api/send-document` | multipart: `sessionId, target, caption, file` |
| POST | `/api/broadcasts` | `{name, message, sessionIds[], targets[], delayMs}` |
| GET | `/api/broadcasts` | List + progres |
| GET | `/api/broadcasts/:id` | Detail + status tiap target |
| POST | `/api/broadcasts/:id/cancel` | Batalkan yang sedang jalan |

`target` bisa nomor (`62812xxx`), JID grup (`xxx@g.us`), atau JID lengkap.

## Env (wa-gateway)

| Var | Default | Keterangan |
|---|---|---|
| `PGHOST` / `PGPORT` / `PGUSER` | `infra_postgres/5432/postgres` | Koneksi DB |
| `POSTGRES_PASSWORD` / `PGPASSWORD` | — | Diambil dari `01-infra/.env` via `env_file` |
| `PGDATABASE` | `wagateway` | Dibuat otomatis bila belum ada |
| `AUTH_ROOT` | `./sessions` | Folder auth per sesi |
| `PORT` | `5000` | Port API |

## Catatan

- Jeda antar pesan: 3–7 detik acak per sesi (queue) + `delayMs` antar target broadcast (default 5 dtk). Jangan di-nol-kan — rawan diblokir WhatsApp.
- Sesi lama v1 (`auth_info_baileys/`) tidak dipakai lagi; scan ulang di dashboard.
