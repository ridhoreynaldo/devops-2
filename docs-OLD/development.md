# setting domain local
    - sudo nano /etc/hosts
        - 127.0.0.1   app1.test
    - C:\Windows\System32\drivers\etc
        - 127.0.0.1     ridhoreynaldo.org
# struktur 
📁 /opt/devops
 ├── 📁 00-gateway/
 │    ├── 📁 logs/                 <-- Log Nginx (access & error)
 │    ├── 📁 ssl/                  <-- KHUSUS SSL MANUAL (Dari Cloudflare / Beli Sendiri)
 │    │    ├── 📁 portaluniversitasquality-ac-id/
 │    │    │   ├── 📄 fullchain.pem/crt
 │    │    │   └── 📄 private.key
 │    │    ├── 📁 ridhoreynaldo-com/
 │    │    │   ├── 📄 fullchain.pem/crt
 │    │    │   └── 📄 private.key
 │    │    ├── 📁 villaberastagimas-com/
 │    │    │   ├── 📄 fullchain.pem/crt
 │    │    │   └── 📄 private.key
 │    │
 │    ├── 📁 letsencrypt/         <-- KHUSUS SSL OTOMATIS (Akan diisi otomatis oleh Certbot)
 │    │
 │    ├── 📁 certbot/
 │    │    └── 📁 www/            <-- Folder rahasia verifikasi ACME Challenge Let's Encrypt
 │    │
 │    ├── 📁 nginx/
 │    │    ├── 📁 conf.d/
 │    │    │   ├── 📄 00-default.conf
 │    │    │   ├── 📄 app2_portaluniversitasquality-ac-id-6923.conf
 │    │    │   ├── 📄 app2_villaberastagimas-com.conf
 │    │    └── 📄 nginx.conf
 │    └── 📄 docker-compose.yml
 │
 ├── 📁 01-infra/
 │    ├── 📁 backup/
 │    ├── 📁 redis/
 │    ├── 📁 postgres/
 │    ├── 📁 sqlserver/
 │    ├── 📄 docker-compose.yml
 │
 ├── 📁 02-monitoring/
 │    ├── 📁 prometheus/
 │    │    ├── 📄 prometheus.yml
 │    ├── 📄 docker-compose.yml
 │
 ├── 📁 03-tunnel/
 │    ├── 📄 docker-compose.yml   <- cloudflare tunnel>
 ├── 📁 04-services/
 │    ├── 📁 rclone/
 │    ├── 📁 wa-gateway/
 │    ├── 📄 docker-compose.yml
 ├── 📁 apps/
 │    ├── 📁 app-3/
 │    │    ├── 📁 ridhoreynaldo-com/
 │    │    │   ├── 📁 nginx/                    <-- (Hanya melayani traffic internal dari Global Nginx)
 │    │    │   │   └── 📄 default.conf          <-- HANYA listen port 80 (Internal)
 │    │    │   ├── 📁 php/                      <-- PENGATURAN PHP PROJECT INI
 │    │    │   │   ├── 📄 Dockerfile            <-- Build image & simpan SC & custom PHP (install ekstensi)
 │    │    │   │   ├── 📄 custom.ini            <-- Setting php.ini (upload_max_filesize, memory_limit)
 │    │    │   │   ├── 📄 docker-entrypoint.sh
 │    │    │   │   └── 📄 www.conf              <-- Setting PHP-FPM (pm.max_children, dll)
 │    │    │   ├── 📁 logs/                     <-- LOG KHUSUS PROJECT INI
 │    │    │   │   ├── 📁 nginx/                <-- Menyimpan access.log & error.log Nginx
 │    │    │   │   └── 📁 php/                  <-- Menyimpan error.log & slow.log PHP-FPM
 │    │    │   ├── 📁 src/                      <-- kode Laravel (baca utama nnti public)
 │    │    │   ├── 📄 docker-compose.yml
 │    │    │   ├── 📄 .dockerignore             <-- ignore vendor, node_module dan .env
 │    │    │   └── 📄 .env                      <-- menyimpan konfig agar docker compose lebih dinamis NGINX_PORT=6923
 │
 ├── 📁 scripts/
 ├── 📄 .env
 └── 📄 .gitignore

# Buat Network "Jalur Dalam"
    - docker network create global-gateway-net
