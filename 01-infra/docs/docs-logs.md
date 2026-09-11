# Instalation
cd /opt/devops/01-infra
docker compose up -d

# LOKASI 
/var/opt/mssql
/var/opt/pgsql

# loging default x loging
Melihat semua log: docker compose logs -f

Melihat log spesifik (contohnya Postgres): docker logs -f infra_postgres

Melihat log Postgres: docker logs infra_postgres
Melihat log realtime SQL Server: docker logs -f infra_sqlserver
Melihat 50 baris log terakhir PgBouncer: docker logs --tail 50 infra_pgbouncer