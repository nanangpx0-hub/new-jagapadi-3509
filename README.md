# JAGAPADI v3 — Monorepo (`new-jagapadi-3509`)

Sistem Pelaporan & Analitik Pertanian Kabupaten Jember (`3509`) — *Full-Stack Modern Rewrite* berbasis **Laravel 11 (PHP 8.3)**, **React 19 PWA (TypeScript + Vite)**, **PostgreSQL 16 + PostGIS 3.4**, dan **Redis 7**.

## Struktur Monorepo

```text
new-jagapadi-3509/
├── apps/
│   ├── api/                 # Backend API — Laravel 11 (PHP 8.3 LTS)
│   └── web/                 # Frontend SPA & Field PWA — React 19 + TS + Vite
├── packages/
│   └── shared/              # Kontrak tipe TypeScript otomatis dari OpenAPI (`openapi-typescript`)
├── docker/                  # Konfigurasi kontainer & SQL inisialisasi PostGIS
├── docs/                    # Blueprint, PRD, Roadmap, Spesifikasi Server, & Dokumentasi Laragon
├── docker-compose.yml       # PostgreSQL 16 + PostGIS 3.4, Redis 7, Mailpit
└── package.json             # Konfigurasi NPM Workspaces
```

## Spesifikasi Server Host (`DESKTOP-221G8EB`)

- **Model:** Lenovo ThinkStation `30BGS0LK00` (`DESKTOP-221G8EB`)
- **Prosesor:** Intel(R) Xeon(R) CPU E3-1220 v6 @ 3.00GHz (4 Core)
- **Memori:** 32.0 GB RAM @ 2400 MHz (PostgreSQL dituning dengan `shared_buffers=2GB`, `effective_cache_size=6GB`)
- **Penyimpanan:** 1.14 TB (tersisa ±335 GB)
- **GPU:** NVIDIA Quadro P600 (2 GB)
- **Sistem Operasi:** Windows 11 Pro 25H2 (OS Build `26200.6718`)

Detail lengkap perangkat keras dan alokasi memori WSL2 tersedia di [`docs/SERVER-HARDWARE-SPEC.md`](docs/SERVER-HARDWARE-SPEC.md).

## Cara Menjalankan Infrastruktur Lokal

1. **Salin konfigurasi environment Docker:**
   ```bash
   cp .env.example .env
   ```
2. **Nyalakan layanan kontainer (PostgreSQL + PostGIS, Redis, Mailpit):**
   ```bash
   docker compose up -d
   ```
3. **Daftar Endpoint Lokal (Loopback `127.0.0.1`):**
   - **PostgreSQL 16.4 + PostGIS 3.4.3:** `127.0.0.1:5432` (DB: `jagapadi_v3`, User: `jagapadi`)
   - **Redis 7:** `127.0.0.1:16379` (dipetakan ke port kontainer `6379`)
   - **Mailpit UI & SMTP:** `http://127.0.0.1:8025` (UI) & `127.0.0.1:1025` (SMTP)

## Dokumentasi Lengkap

Lihat indeks dokumentasi di [`docs/README.md`](docs/README.md):
- [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) — Arsitektur & model data terpadu
- [`docs/PRD.md`](docs/PRD.md) — Matriks RBAC 5 role & spesifikasi 6 domain laporan
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Rencana eksekusi Fase 0 s.d. Fase 5
- [`docs/PHASE0-INFRA-STATUS-2026-11-03.md`](docs/PHASE0-INFRA-STATUS-2026-11-03.md) — Bukti verifikasi infrastruktur Fase 0
