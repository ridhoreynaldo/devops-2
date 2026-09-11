
## 📁 Struktur Folder
/opt/devops
├── 00-gateway/       # Reverse proxy utama (SSL, routing semua domain)
├── 01-infra/         # Database, cache, dan backup terpusat
├── 02-monitoring/    # Observability stack (Prometheus dkk)
├── 03-services/      # Layanan pendukung (rclone, WA Gateway, dll)
├── apps/             # Kumpulan aplikasi (multi-tenant, per domain)
├── scripts/          # Automation script (deploy, backup, dsb)
├── .env              # Environment variable global
└── .gitignore