# Setup domain host
docker compose up -d --build
sudo nano /etc/hosts
127.0.0.1  ridhoreynaldo.com
127.0.0.1  www.ridhoreynaldo.com
# WSL
hostname -I
172.20.141.106

* 🚀 Create Global Gateway Network
    # docker network create global-gateway-net
* 🚀 Comment SSL Let's Encrypt *.conf
    # server { listen 443 ssl ... }
* 🚀 Start Gateway Nginx
    # cd /opt/devops/00-gateway
    # docker compose up -d gateway_nginx
* 🚀 Generate SSL Let's Encrypt
    # docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d ridhoreynaldo.com -d www.ridhoreynaldo.com
    * Atau
    # docker compose run --rm --entrypoint "certbot" certbot certonly --webroot --webroot-path /var/www/certbot/ -d ridhoreynaldo.com -d www.ridhoreynaldo.com
* 🚀 up gateway 
    # cd /opt/devops/00-gateway 
    # docker compose up -d gateway_nginx

    # cd /opt/devops/apps/app-3/ridhoreynaldo-com
    # docker compose up -d --build

# Restart
docker compose restart gateway_nginx
# Hapus cache build yang nyangkut dan membebani storage
docker builder prune -f

# menghancurkan cache volume kode yang lama agar tidak nyangkut.
docker compose down -v

# Build ulang secara bersih
docker compose build --no-cache php-local

# change .env (container / opcache restart)
* 1. Matikan dan hapus container lama
docker compose down
* 2. Nyalakan ulang agar Docker membaca file .env yang baru
docker compose up -d
* 3. Jalankan clear config sekali di dalam container yang baru lahir
docker exec -it php_ridhoreynaldo php artisan config:clear  
* 4. Jalan pintas untuk me-restart PHP-FPM & membersihkan OPcache
docker compose restart php-local 


# change /php/custom.ini | www.conf
docker compose restart php-local