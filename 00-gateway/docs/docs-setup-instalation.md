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
cd /opt/devops/apps/app-5/portaluniversitasquality-ac-id-1337
docker compose up -d --build
docker exec -it php_portaluniversitasquality-ac-id-1337 php artisan key:generate
docker exec -it php_portaluniversitasquality-ac-id-1337 php artisan migrate --force   # bisa dipakai saat CI/CD agar auto semua
docker compose exec php-local php artisan migrate # <- pakai ini simpel --seed

# KUNCI CACHE LARAVEL (WAJIB PRODUCTION)
docker exec -it php_portaluniversitasquality-ac-id-1337 php artisan optimize
docker exec -it php_portaluniversitasquality-ac-id-1337 php artisan view:cache

# Perubahan KODE (PROD)
cd /opt/devops/apps/app-5/portaluniversitasquality-ac-id-1337
docker exec -it php_portaluniversitasquality-ac-id-1337 php artisan optimize:clear
# (PHP / Blade / CSS / Vendor)
git pull origin main
docker compose down -v  # Hancurkan container LAMA beserta Volume "app-code" (PENTING! flag -v)
docker compose up -d --build
docker exec -it php_portaluniversitasquality-ac-id-1337 php artisan optimize
docker exec -it php_portaluniversitasquality-ac-id-1337 php artisan view:cache

# Hanya mengubah file .env (DEV/PROD)
cd /opt/devops/apps/app-5/portaluniversitasquality-ac-id-1337
docker compose restart php-local
docker exec -it php_portaluniversitasquality-ac-id-1337 php artisan config:cache
docker compose exec php-local php artisan optimize:clear # <-DEV>

# Ubah Nginx Local
docker compose restart nginx-local

# Ubah Nginx Global
cd /opt/devops/00-gateway
docker compose restart gateway_nginx
# tanpa restart
docker exec global_gateway nginx -s reload
docker exec -it global_gateway nginx -s reload

# install vendor (DEV MODE)
docker exec -it php_portaluniversitasquality-ac-id-1337 composer install
docker compose exec php-local composer install # pakai ini aja simpel

# Config Global .conf/nginx berubah restart agar dibaca ulang
docker compose exec gateway_nginx nginx -t
docker compose exec gateway_nginx nginx -s reload

# ganti src baru
cd /opt/devops/apps/app-5/portaluniversitasquality-ac-id-1337
docker compose down
docker compose up -d
# ? apakah dibawah wajib ?
docker compose exec php-local composer install
docker compose exec php-local chown -R www-data:www-data storage bootstrap/cache
docker compose exec php-local php artisan key:generate
docker compose exec php-local php artisan optimize:clear

# Instal Infra Postgresql
cd /opt/devops/01-infra/postgres
docker compose up -d
 * backup
docker exec -t infra_postgres pg_dumpall -U postgres > backup_semua_database.sql
 * tes koneksi tinker
docker compose exec php-local php artisan tinker
DB::connection()->getPdo();



# PORT BARU/ PROJECT BARU WAJIB
docker compose down
docker compose up -d