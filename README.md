# 🚀 DevOps Infrastructure

Infrastruktur multi-service berbasis Docker Compose untuk mengelola beberapa aplikasi web (Laravel/PHP) di balik satu **Global Nginx Gateway**, lengkap dengan SSL, monitoring, tunneling, dan backup terpusat.

---

## 📐 Arsitektur

Struktur ini dirancang dengan prinsip **modular per-layer**, di mana setiap folder angka (`00-`, `01-`, dst) merepresentasikan lapisan infrastruktur yang independen namun saling terhubung lewat Docker network.

```
Internet
   │
   ▼
┌─────────────────────┐
│  00-gateway (Nginx)  │  ← Reverse proxy + SSL termination
└─────────┬────────────┘
          │
   ┌──────┴───────┬──────────────┬──────────────┐
   ▼               ▼              ▼              ▼
01-infra      02-monitoring   03-tunnel      04-services
(DB/Redis)    (Prometheus)    (Cloudflare)   (rclone, WA GW)
          │
          ▼
    apps/app-{n}/{domain}
    (Laravel + PHP-FPM + Nginx internal)
```

**Alur request:**
`Client → Nginx Gateway (00-gateway) → Nginx internal per-app → PHP-FPM → Laravel`

---

## 📁 Struktur Folder

```
/opt/devops
├── 00-gateway/       # Reverse proxy utama (SSL, routing semua domain)
├── 01-infra/         # Database, cache, dan backup terpusat
├── 02-monitoring/    # Observability stack (Prometheus dkk)
├── 03-tunnel/        # Cloudflare Tunnel (expose tanpa buka port publik)
├── 04-services/      # Layanan pendukung (rclone, WA Gateway, dll)
├── apps/             # Kumpulan aplikasi (multi-tenant, per domain)
├── scripts/          # Automation script (deploy, backup, dsb)
├── .env              # Environment variable global
└── .gitignore
```

---

## 🧩 Detail Setiap Layer

### 1️⃣ `00-gateway/` — Nginx Reverse Proxy & SSL

Pusat lalu lintas dari seluruh domain yang di-hosting.

| Folder/File | Fungsi |
|---|---|
| `logs/` | Access & error log Nginx global |
| `ssl/` | Sertifikat SSL **manual** (Cloudflare Origin CA / beli sendiri), 1 folder per domain |
| `letsencrypt/` | Sertifikat SSL **otomatis** dari Certbot |
| `certbot/www/` | Folder validasi ACME Challenge untuk penerbitan SSL Let's Encrypt |
| `nginx/conf.d/` | File konfigurasi vhost per domain/aplikasi |
| `nginx/nginx.conf` | Konfigurasi utama Nginx |
| `docker-compose.yml` | Definisi container gateway |

> 💡 **Konvensi penamaan config:** `app{n}_{domain-dengan-strip}[-{port}].conf`
> Contoh: `app2_portaluniversitasquality-ac-id-6923.conf`

---

### 2️⃣ `01-infra/` — Database & Storage Layer

Berisi seluruh service data yang dipakai bersama (shared) oleh aplikasi-aplikasi di `apps/`.

| Folder | Fungsi |
|---|---|
| `postgres/` | Database PostgreSQL |
| `sqlserver/` | Database SQL Server |
| `redis/` | Cache & session store |
| `backup/` | Hasil backup terjadwal seluruh database |

---

### 3️⃣ `02-monitoring/` — Observability

| Folder/File | Fungsi |
|---|---|
| `prometheus/prometheus.yml` | Konfigurasi target scraping metrik |

---

### 4️⃣ `03-tunnel/` — Cloudflare Tunnel

Menghubungkan server ke Cloudflare tanpa perlu membuka port publik secara langsung — meningkatkan keamanan sekaligus menyembunikan IP origin.

---

### 5️⃣ `04-services/` — Layanan Tambahan

| Folder | Fungsi |
|---|---|
| `rclone/` | Sinkronisasi/mount storage cloud (Google Drive, S3, dll) |
| `wa-gateway/` | Gateway WhatsApp (notifikasi, integrasi bot, dsb) |

---

### 6️⃣ `apps/` — Multi-Tenant Applications

Setiap aplikasi memiliki namespace sendiri: `apps/app-{n}/{nama-domain}/`, sehingga penambahan aplikasi baru **tidak mengganggu** aplikasi lain.

```
apps/app-3/ridhoreynaldo-com/
├── nginx/
│   └── default.conf        # Listen port 80, hanya trafik internal dari Gateway
├── php/
│   ├── Dockerfile           # Build image PHP + ekstensi custom
│   ├── custom.ini           # php.ini (upload_max_filesize, memory_limit, dll)
│   ├── docker-entrypoint.sh
│   └── www.conf              # Konfigurasi PHP-FPM (pm.max_children, dll)
├── logs/
│   ├── nginx/                # access.log & error.log
│   └── php/                  # error.log & slow.log PHP-FPM
├── src/                       # Source code Laravel
├── docker-compose.yml
├── .dockerignore              # ignore vendor, node_modules, .env
└── .env                       # Config dinamis, mis. NGINX_PORT=6923
```

> 🔒 **Isolasi jaringan:** Nginx internal setiap app **tidak** expose ke publik — hanya bisa diakses lewat jaringan internal Docker dari `00-gateway`.

---

### 7️⃣ `scripts/` — Automation

Kumpulan script pendukung operasional (deploy, backup manual, restart service, dll).

---

## ⚙️ Cara Menjalankan

Setiap layer dijalankan secara independen menggunakan Docker Compose miliknya masing-masing. Urutan yang disarankan:

```bash
# 1. Jalankan layer infrastruktur dasar terlebih dahulu
cd 01-infra && docker compose up -d

# 2. Jalankan monitoring (opsional tapi disarankan)
cd ../02-monitoring && docker compose up -d

# 3. Jalankan tunnel (jika pakai Cloudflare Tunnel)
cd ../03-tunnel && docker compose up -d

# 4. Jalankan service pendukung
cd ../04-services && docker compose up -d

# 5. Jalankan aplikasi (ulangi untuk tiap app)
cd ../apps/app-3/ridhoreynaldo-com && docker compose up -d --build

# 6. Terakhir, jalankan Gateway agar semua trafik bisa masuk
cd ../../../00-gateway && docker compose up -d
```

> ⚠️ Pastikan semua service berada pada Docker **network** yang sama agar Gateway dapat mem-proxy ke container aplikasi.

---

## ➕ Menambahkan Aplikasi Baru

1. Duplikat folder template di `apps/app-{n}/{domain-baru}/`
2. Sesuaikan `.env` (misalnya `NGINX_PORT`)
3. Sesuaikan `src/` dengan source code project
4. Buat file config baru di `00-gateway/nginx/conf.d/app{n}_{domain}-{port}.conf`
5. Siapkan sertifikat SSL:
   - **Manual:** taruh di `00-gateway/ssl/{domain}/`
   - **Otomatis:** jalankan Certbot, hasil akan masuk ke `00-gateway/letsencrypt/`
6. Reload Nginx Gateway:
   ```bash
   docker exec -it <container_nginx_gateway> nginx -s reload
   ```

---

## 🔐 Keamanan & Best Practice

- ✅ Semua `.env` dan `vendor/`, `node_modules/` **wajib** masuk `.gitignore` / `.dockerignore`
- ✅ Aplikasi tidak pernah expose port langsung ke publik — selalu lewat Gateway
- ✅ Gunakan Let's Encrypt untuk domain baru, simpan sertifikat manual hanya untuk kasus khusus (Cloudflare Origin CA, dll)
- ✅ Backup database terjadwal disimpan di `01-infra/backup/`
- ✅ Pisahkan log per aplikasi agar mudah di-debug tanpa mengganggu aplikasi lain

---

## 🗂️ Ringkasan Layer

| Layer | Peran |
|---|---|
| `00-gateway` | Pintu masuk semua trafik + SSL |
| `01-infra` | Database, cache, backup |
| `02-monitoring` | Observability & metrik |
| `03-tunnel` | Koneksi aman tanpa expose port publik |
| `04-services` | Layanan pendukung (integrasi, storage) |
| `apps/` | Aplikasi-aplikasi yang dihosting |
| `scripts/` | Automation & maintenance |

---

*Dokumentasi ini menggambarkan struktur infrastruktur secara umum — sesuaikan detail konfigurasi dengan kebutuhan masing-masing environment (development/staging/production).*