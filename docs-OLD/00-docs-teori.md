# best practice
    -> di /opt/devops atau nama sesuai sop deh


# 1. Beginner (Newbie / Foundation / Legacy)
* Fokus: bisa bikin aplikasi jalan end-to-end
* Fokus: Memahami alur web berjalan dari depan sampai ke database (End-to-End).
    - Traffic: 100 - 1.000 user/hari (Cocok untuk aplikasi internal kantor kecil, admin panel, atau tugas akhir).
    - Tech Stack:
        + Windows / WSL
        + Apache (XAMPP) atau php artisan serve bawaan.
        + PHP Native / Laravel Basic + Blade.
        + MySQL (1NF - 3NF basic, CRUD).
        + Git Basic (Clone, Commit, Push).
    - Arsitektur: Monolith murni.
    - Deployment: Shared Hosting (cPanel) atau Lokal.

# 2. Intermediate (Production Small-Medium Scale)
* Fokus: mulai ngerti best practice & deployment yang benar
* Fokus: Standarisasi produksi, stabilitas, dan otomasi deployment.
    - Traffic: 10.000 - 100.000 user/hari (Startup tahap awal, aplikasi SaaS menengah).
    - Tech Stack:
        + Linux (Ubuntu Server di VPS seperti DigitalOcean / AWS EC2).
        + Nginx + PHP-FPM (Jauh lebih tangguh dari Apache XAMPP).
        + Laravel (Service Pattern, Job/Queue, Form Request Validation).
        + React / Vue (REST API via Fetch/Axios).
        + PostgreSQL (Query optimization, Indexing, Transaction).
        + Docker + Docker Compose (Otomatisasi environment).
        + Trello / Asana untuk Project Manajemen & Jira untuk metode Agile/Scrum mengatur Sprint. 
        + Unit Testing (PHPUnit / Jest / JUnit) & API Testing (Postman Automation).
        + Swagger / OpenAPI.
        + Git (Branching, Merge Request) + GitHub Actions (CI/CD Basic).
        + Redis (Untuk caching ringan dan session).
    - Arsitektur: Monolith modern dengan background jobs.
    - Best Practice Direktori (Sesuai SOP):
        + Di level ini kamu mulai deploy ke VPS. Gunakan /opt/namaproject atau /opt/devops/namaproject untuk aplikasi berbasis Docker/Go/Node.
        + /var/www/html/ masih bisa dipakai, tapi itu adalah gaya klasik (SOP lama) khusus untuk web server tradisional. Modern deployment lebih menyukai /opt/ karena dianggap sebagai add-on software yang dibungkus rapi.

# Kamu disini Early Advanced
# 3. Advanced (Scalable System)
* Fokus: High availability (tidak boleh down), observability, dan pemisahan beban (Scaling).
    - Traffic: 500.000 - 1.000.000+ user/hari (E-commerce menengah, aplikasi viral).
    - Tech Stack:
        + Golang (Untuk service yang butuh kecepatan tinggi/konkurensi).
        + Traefik / Nginx Ingress (Load Balancing / Rate Limiting).
        + PostgreSQL (Replication: 1 Master untuk Tulis, 2 Worker untuk Baca).
        + Docker Advanced / Podman + Kubernetes (K8s) Basic. (Docker Swarm)
        + RabbitMQ / Redis Queue (Message broker antar service).
        + Webhooks & WebSockets (Realtime data).
        + CI/CD Pipeline yang ketat (Jenkins / GitLab CI).
        + End-to-End (E2E) Testing (Selenium, Cypress, Playwright).
        + GraphQL.
        + Load / Stress Testing (k6, JMeter).
        + SonarQube / Snyk.
        + Observability: Grafana + Prometheus (Metrik CPU/RAM), ELK Stack (Centralized Logging) <- INI ELASTICSEARCH.
    - Arsitektur: Transisi dari Monolith ke SOA (Service Oriented Architecture) atau Mini-services.
    - Infrastruktur: Scale Horizontal (Menambah jumlah server/pod, bukan memperbesar RAM).

# 4. Expert / Architect (Unicorn Scale)
* Fokus: Desain sistem terdistribusi berskala masif, efisiensi biaya awan, dan ketahanan terhadap bencana (Fault Tolerance).
* Traffic: Puluhan hingga Ratusan Juta request/hari (Skala Tokopedia, Gojek, Traveloka).
    - Tech Stack:
        + Microservices & Event-Driven Architecture.
        + Apache Kafka (Pusat saraf data dan event streaming berkapasitas raksasa).
        + Managed Cloud Services (AWS EKS, GCP GKE, RDS, S3).
        + Database Sharding (Memecah 1 database besar menjadi banyak server berdasarkan kategori/lokasi).
        + Infrastructure as Code (Terraform, Ansible).
        + Distributed Tracing (Jaeger / OpenTelemetry) untuk melacak error yang melompat-lompat antar microservices.
        + Multi-AZ (Availability Zone) — Server tersebar di beberapa pusat data (misal: Jakarta dan Singapura) agar jika satu gedung mati lampu, sistem tetap hidup.

