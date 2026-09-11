# Buat Jaringan Global (Gateway Network)
docker network create global-gateway-net

# Nyalakan Global Gateway & SSL ############################################################################################
cd /opt/devops/00-gateway
docker compose up -d

# Nyalakan INFRA DB SQL / NOSQL ############################################################################################
* ??

# CI/CD (Github Action + Webhook / Jenkins) ################################################################################
* ??
deploy automation
backup
maintenance
restart service
CI/CD hook

# Nyalakan Stack Monitoring (Opsional tapi Penting) ########################################################################
cd /opt/devops/02-monitoring
docker compose up -d

# Siapkan Kebutuhan Aplikasi ###############################################################################################
cd /opt/devops/apps/app-3/ridhoreynaldo-com
docker compose up -d --build
docker exec -it php_ridhoreynaldo php artisan key:generate
docker exec -it php_ridhoreynaldo php artisan migrate --force   # bisa dipakai saat CI/CD agar auto semua

# KUNCI CACHE LARAVEL (WAJIB PRODUCTION)
docker exec -it php_ridhoreynaldo php artisan optimize
docker exec -it php_ridhoreynaldo php artisan view:cache

# Perubahan KODE (PROD)
cd /opt/devops/apps/app-3/ridhoreynaldo-com
docker exec -it php_ridhoreynaldo php artisan optimize:clear
# (PHP / Blade / CSS / Vendor)
git pull origin main
docker compose down -v  # Hancurkan container LAMA beserta Volume "app-code" (PENTING! flag -v)
docker compose up -d --build
    # Kunci ulang cache Laravel
    docker exec -it php_ridhoreynaldo php artisan optimize
    docker exec -it php_ridhoreynaldo php artisan view:cache
# Hanya mengubah file .env (DEV/PROD)
docker compose restart php-local    # Cukup restart container PHP
docker exec -it php_ridhoreynaldo php artisan config:cache      # Perbarui cache config Laravel agar membaca .env baru

# install vendor (DEV MODE)
docker exec -it php_ridhoreynaldo composer install

# Ubah Nginx Local
docker compose restart nginx-local

# agar bisa baca tulis langsung
# Ubah kepemilikan folder src kembali ke user host saat ini ($USER)
docker exec -u "$(id -u):$(id -g)" -it php_portaluniversitasquality-ac-id-1337 sh
sudo chown -R $USER:$USER /opt/devops/apps/app-5/portaluniversitasquality-ac-id-1337/src