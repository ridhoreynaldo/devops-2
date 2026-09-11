# Delete Zone identifier
find . -name "*:Zone.Identifier" -type f -delete

# Nyalakan Sekali saja network global
docker network create global-gateway-net

# Nyalakan Stack Monitoring (Opsional tapi Penting) ########################################################################
cd /opt/devops/02-monitoring
docker compose up -d

# Portainer
    setelah dijalankan portainer (hanya 5 menit buat buat akun setup)
    http://172.20.141.106:9000/
    ip docker/server

    admin:password12345

    cek log for setup token
    docker restart devops_portainer
    docker logs devops_portainer


# Uptime Kuma
    http://172.20.141.106:3001/
    ip docker/server

    admin:password12345


# Grafana
    http://172.20.141.106:3000
    admin:admin (default)
    admin:password12345 (now)