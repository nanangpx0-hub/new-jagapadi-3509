# JAGAPADI v3 — Status Infrastruktur Fase 0

Tanggal penyusunan & verifikasi: 2026-11-03 (WIB)
Workspace: `C:\laragon\www\new-jagapadi-3509`
Host Server: `DESKTOP-221G8EB` (`30BGS0LK00` — Intel Xeon E3-1220 v6 @ 3.00GHz, RAM 32.0 GB, Windows 11 Pro 25H2)
Instalasi Laragon: `C:\laragon`

## 1. Ringkasan dan Status Verifikasi

Seluruh komponen infrastruktur Fase 0 telah diperiksa ulang secara langsung (*live verification*) melalui bridge VS Code pada 2026-11-03. Pemeriksaan meliputi runtime host (PHP, Composer, Node.js, npm), status container Docker Compose, query langsung ke PostgreSQL/PostGIS, serta uji konektivitas Redis.

**Status dokumen ini:** **Infrastruktur host TERVERIFIKASI LULUS.** Dokumen ini hanya mencakup infrastruktur (runtime host dan container). **Fase 0 secara keseluruhan belum selesai**: scaffolding aplikasi (`apps/web`, paket backend sesuai Blueprint, endpoint `/api/health`, dan CI) masih berjalan. Lihat Definisi Selesai Fase 0 di [ROADMAP.md](ROADMAP.md).

## 2. Spesifikasi Server Host (`DESKTOP-221G8EB`)

Detail lengkap tersedia di [SERVER-HARDWARE-SPEC.md](SERVER-HARDWARE-SPEC.md):

| Komponen | Spesifikasi |
|---|---|
| **Model / Device** | `DESKTOP-221G8EB` (`30BGS0LK00`) |
| **Prosesor** | Intel(R) Xeon(R) CPU E3-1220 v6 @ 3.00GHz |
| **Memori (RAM)** | 32.0 GB (2400 MHz) |
| **Penyimpanan** | 1.14 TB (Terpakai 805 GB, Tersisa ±335 GB) |
| **Kartu Grafis** | NVIDIA Quadro P600 (2 GB) |
| **Sistem Operasi** | Windows 11 Pro 25H2 (OS Build `26200.6718`) |

## 3. Hasil Verifikasi Langsung Komponen Runtime & Kontainer

| Komponen | Hasil Verifikasi Langsung (Live Output) | Status |
|---|---|---|
| **PHP CLI** | `PHP 8.3.36 (cli) (built: Oct 26 2026 09:51:04) (ZTS Visual C++ 2019 x64)` | ✅ Terverifikasi |
| **Composer** | `Composer version 2.8.12 2025-09-19 13:41:59` (sesuai target `2.8.x`) | ✅ Terverifikasi |
| **Node.js** | `v24.11.0` (aktif di PATH; `node-v22` tetap tersedia di Laragon) | ✅ Terverifikasi |
| **npm** | `11.6.2` | ✅ Terverifikasi |
| **PostgreSQL** | `PostgreSQL 16.4 on x86_64-pc-linux-musl, 64-bit` (`jagapadi_v3_postgres`) | ✅ `Up (healthy)` |
| **PostGIS** | `POSTGIS="3.4.3 0" [EXTENSION] PGSQL="160" GEOS="3.12.2-CAPI-1.18.2" PROJ="9.4.0" TOPOLOGY` | ✅ Aktif |
| **Redis** | `redis:7-alpine` (`jagapadi_v3_redis`) — `redis-cli ping` → `PONG` | ✅ `Up (healthy)` |
| **Mailpit** | `axllent/mailpit:latest` (`jagapadi_v3_mailpit`) | ✅ `Up (healthy)` |

## 4. Container dan Pemetaan Port Lokal

| Container | Image | Status | Endpoint Host (Loopback) |
|---|---|---|---|
| `jagapadi_v3_postgres` | `postgis/postgis:16-3.4-alpine` | `Up (healthy)` | `127.0.0.1:5432->5432/tcp` |
| `jagapadi_v3_redis` | `redis:7-alpine` | `Up (healthy)` | `127.0.0.1:16379->6379/tcp` |
| `jagapadi_v3_mailpit` | `axllent/mailpit:latest` | `Up (healthy)` | `127.0.0.1:8025->8025/tcp` (UI), `127.0.0.1:1025->1025/tcp` (SMTP) |

Seluruh port diikat secara ketat ke `127.0.0.1` sesuai definisi pada `docker-compose.yml`. Database utama adalah `jagapadi_v3` dengan ekstensi `postgis`, `postgis_topology`, dan `uuid-ossp` terinisialisasi melalui `docker/postgres/init/01-init-postgis.sql`.

## 5. Catatan Teknis & Penyesuaian Host

### 5.1 Composer (`2.8.12`)
Verifikasi langsung di terminal workspace menunjukkan Composer yang aktif adalah **2.8.12**, sehingga telah memenuhi kriteria `2.8.x` tanpa deviasi.

### 5.2 Port Host Redis (`16379`)
Port `6379` berada dalam rentang *excluded port range* Windows Hyper-V/WSL (`6309–6408`) pada mesin ini. Oleh karena itu, `docker-compose.yml` dan `.env` memetakan port host `127.0.0.1:16379` menuju port container `6379`.

### 5.3 Daemon Docker Desktop
Jika workstation `DESKTOP-221G8EB` baru dinyalakan ulang, pastikan aplikasi Docker Desktop sudah berjalan (disarankan mengaktifkan *Start Docker Desktop when you sign in* pada pengaturan Docker Desktop).

## 6. Checklist Penutupan Infrastruktur Fase 0

- [x] Workspace teridentifikasi sebagai `C:\laragon\www\new-jagapadi-3509`.
- [x] Spesifikasi server `DESKTOP-221G8EB` terdokumentasi di `docs/SERVER-HARDWARE-SPEC.md`.
- [x] Versi aktual seluruh komponen runtime (`PHP 8.3.36`, `Composer 2.8.12`, `Node v24.11.0`, `npm 11.6.2`) terkonfirmasi dari keluaran perintah langsung.
- [x] Ketiga container (`postgres`, `redis`, `mailpit`) berstatus `Up (healthy)` dengan pengikatan loopback `127.0.0.1`.
- [x] Hasil query `SELECT version(), PostGIS_Full_Version();` dan `redis-cli ping` (`PONG`) terkonfirmasi secara langsung.
- [x] Layanan Laragon eksisting tetap aman dan tidak dimodifikasi.

> **Langkah Selanjutnya:** Melanjutkan ke tahap *scaffolding monorepo* (`apps/api`, `apps/web`, `packages/shared`) sesuai `docs/ROADMAP.md`.

## 7. Riwayat Dokumen

| Tanggal | Perubahan |
|---|---|
| 2026-11-03 | Menyusun laporan awal berdasarkan berkas lokal. |
| 2026-11-03 | Memperbarui dokumen dengan hasil verifikasi *live* (`PHP 8.3.36`, `Composer 2.8.12`, `Node v24.11.0`, `npm 11.6.2`, `PostgreSQL 16.4 + PostGIS 3.4.3`, `Redis PONG`) serta menambahkan referensi spesifikasi hardware `DESKTOP-221G8EB`. |
