# JAGAPADI v3 — Dokumentasi Lingkungan & Arsitektur (Environment & Architecture Docs)

> **Proyek:** `new-jagapadi-3509` (JAGAPADI v3 — rebuild)
> **Server / Host:** `DESKTOP-221G8EB` (`30BGS0LK00` — Intel Xeon E3-1220 v6 @ 3.00GHz, RAM 32.0 GB, Windows 11 Pro 25H2)
> **Lingkungan yang didokumentasikan:** Docker Compose v3 + Laragon di `C:\laragon` (BPS Kabupaten Jember)
> **Diperbarui:** 2026-11-03 (WIB)

---

## Daftar Dokumen

| # | Dokumen | Isi |
|---|---------|-----|
| 0 | [BLUEPRINT.md](BLUEPRINT.md) | Blueprint arsitektur JAGAPADI v3 (baseline disetujui) |
| 0 | [DESIGN.md](DESIGN.md) | **v3.2** Brief desain & token UI (adopsi penuh mockup pemilik): tiga permukaan A Admin/Backend, B Website Publik (Fase 3.5), C Android PWA |
| 0 | [PROGRES-2026-11-06.md](PROGRES-2026-11-06.md) | Catatan progres eksekusi Fase 1–8 (regenerasi master wilayah BPS 3509, SLS, OPT pangan, dummy laporan, user management, 3 tema, AdminLTE, verifikasi) |
| 0 | [PRD.md](PRD.md) | **Product Requirements Document**: matriks RBAC 5 role, skema detail 6 domain, idempotency offline PWA, dan keputusan modul legacy |
| 0 | [ROADMAP.md](ROADMAP.md) | Rencana fase 0–5 & definisi selesai |
| 0 | [SERVER-HARDWARE-SPEC.md](SERVER-HARDWARE-SPEC.md) | **Spesifikasi perangkat keras server (`DESKTOP-221G8EB`)**, alokasi RAM 32 GB (WSL2/PostgreSQL/Redis), dan checklist operasional host |
| 0 | [PHASE0-INFRA-STATUS-2026-11-03.md](PHASE0-INFRA-STATUS-2026-11-03.md) | **Status & bukti verifikasi live infrastruktur Fase 0** (Docker, PostgreSQL 16.4 + PostGIS 3.4.3, Redis 7, Mailpit, PHP 8.3.36, Composer 2.8.12, Node v24.11.0) |
| 0 | [GAP-CHECK-2026-11-02.md](GAP-CHECK-2026-11-02.md) | Pemeriksaan kekurangan awal & status resolusinya |
| 1 | [LARAGON-ENVIRONMENT.md](LARAGON-ENVIRONMENT.md) | **Ikhtisar lingkungan**: versi Laragon, semua komponen runtime + versi, status service, path penting |
| 2 | [LARAGON-CONFIGURATION.md](LARAGON-CONFIGURATION.md) | **Konfigurasi detail**: struktur direktori, `laragon.ini`, Apache/httpd.conf, virtual hosts, hosts file, alias tools, SSL, akses LAN |
| 3 | [LARAGON-DATABASE.md](LARAGON-DATABASE.md) | **Database MySQL 8.0.30**: konfigurasi, inventaris 45+ database, kredensial default, backup/restore, catatan upgrade & pemisahan dengan PostgreSQL v3 |
| 4 | [LARAGON-WWW-INVENTORY.md](LARAGON-WWW-INVENTORY.md) | **Inventaris proyek di `C:\laragon\www`**: jenis stack, URL akses, proyek aktif vs arsip |
| 5 | [LARAGON-OPERATIONS.md](LARAGON-OPERATIONS.md) | **Operasional & pemeliharaan**: start/stop, health check, troubleshooting, keamanan, dan status penyelesaian prasyarat Fase 0 |

---

## Ringkasan Satu Halaman

- **Perangkat Keras Server (`DESKTOP-221G8EB` / `30BGS0LK00`)**: Intel Xeon E3-1220 v6 @ 3.00GHz (4-Core), RAM **32.0 GB** (2400 MHz), GPU NVIDIA Quadro P600 (2 GB), Storage 1.14 TB (tersisa ±335 GB), sistem operasi **Windows 11 Pro 25H2** (Build `26200.6718`).
- **Stack Docker JAGAPADI v3 (Aktif & Healthy)**:
  - `jagapadi_v3_postgres`: **PostgreSQL 16.4 + PostGIS 3.4.3** (`127.0.0.1:5432`, database `jagapadi_v3`, ekstensi `postgis`, `postgis_topology`, `uuid-ossp` aktif).
  - `jagapadi_v3_redis`: **Redis 7** (`127.0.0.1:16379->6379/tcp`, respons `PONG` terverifikasi).
  - `jagapadi_v3_mailpit`: **Mailpit** (`127.0.0.1:8025` UI, `127.0.0.1:1025` SMTP).
- **Runtime Host & Laragon 6.0.0 (`C:\laragon`)**:
  - **PHP 8.3.36** aktif seragam di semua jalur (CLI, Apache `mod_fcgid` → `php-cgi`, dan `mod_php`).
  - **Composer 2.8.12**, **Node.js v24.11.0** (di PATH; `node-v22` juga tersedia di Laragon), **npm 11.6.2**, **Git 2.37.3**.
  - **MySQL 8.0.30** (port 3306, datadir `C:\laragon\data\mysql-8`) tetap dipertahankan untuk melayani sistem lama (`jagapadi-3509`) dan sumber impor data referensi.

---

## Cara Memperbarui Dokumentasi Ini

Dokumen ini bersifat snapshot hidup. Bila komponen berubah (tuning Docker Compose, scaffolding monorepo, upgrade DB), perbarui bagian terkait dan catat di bagian **Riwayat Perubahan** pada masing-masing dokumen. Snapshot ulang sebaiknya dilakukan minimal setiap kali menutup satu fase roadmap.

---

*Dokumen terkait di luar folder ini: `C:\laragon\LAN-ACCESS-GUIDE.md` (panduan akses LAN yang sudah ada), dokumentasi sistem lama di `C:\laragon\www\jagapadi-3509\docs\`.*
