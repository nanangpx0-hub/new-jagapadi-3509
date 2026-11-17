# JAGAPADI v3 — Monorepo (`new-jagapadi-3509`)

Sistem Pelaporan & Analitik Pertanian Kabupaten Jember (`3509`) — *Full-Stack Modern Rewrite* berbasis **Laravel 11 (PHP 8.3)**, **React 19 PWA (TypeScript + Vite)**, **PostgreSQL 16 + PostGIS 3.4**, dan **Redis 7**.

Platform ini mengintegrasikan pelaporan lapangan multi-domain pertanian dengan pengumpulan fenomena statistik untuk **Badan Pusat Statistik (BPS) Kabupaten Jember** (Survei KSA, Survei Ubinan, dan PDRB Pertanian).

---

## Fitur Utama

- **6 Domain Laporan Pertanian:** Hama/OPT, Irigasi, Ketersediaan Pupuk, Panen & Ubinan, Cuaca/Iklim, Alat & Mesin Pertanian (Alsintan).
- **Pengumpulan Fenomena Statistik BPS:** Dilengkapi atribut komoditas, kode segmen KSA, fase tumbuh KSA, klasifikasi dampak statistik, serta generator narasi fenomena otomatis dan ekspor CSV berstandar BPS.
- **Validasi Silang KSA & Anomali Blank-Spot:** Perbandingan data luas panen & puso KSA bulanan (341 data amatan se-Jember) dengan laporan lapangan untuk mendeteksi wilayah terdampak yang belum terlaporkan.
- **Sistem Geospasial PostGIS & Deteksi Kluster Outbreak:** Reverse-geocoding koordinat GPS otomatis ke 31 Kecamatan, 248 Desa, dan 16.543 SLS (Satuan Lingkungan Setempat), disertai algoritma *spatial clustering* untuk peringatan dini ledakan hama.
- **Matriks Peran Berjenjang (RBAC 6 Peran):** `superadmin`, `admin`, `operator`, `statistisi`, `petugas` (mitra statistik), dan `viewer`.
- **Sistem Audit Log & Keamanan:** Pencatatan otomatis seluruh aktivitas (login, kelola pengguna, siklus laporan), *first-login password enforcement* (`must_change_password`), dan notifikasi in-app siklus laporan.
- **Alur Usulan Master OPT:** Alur pengajuan spesies OPT baru dari lapangan hingga verifikasi dan penerbitan kode master OPT aktif oleh operator/admin.
- **Progressive Web App (PWA):** Offline-first draft di IndexedDB, ekstraksi metadata koordinat EXIF kamera, dan sinkronisasi otomatis saat kembali online.

---

## Struktur Monorepo

```text
new-jagapadi-3509/
├── apps/
│   ├── api/                 # Backend API — Laravel 11 (PHP 8.3 LTS) + PostGIS
│   └── web/                 # Frontend SPA & Field PWA — React 19 + TS + Vite
├── packages/
│   └── shared/              # Kontrak tipe TypeScript otomatis dari OpenAPI (`openapi-typescript`)
├── docker/                  # Konfigurasi kontainer & SQL inisialisasi PostGIS
├── docs/                    # Blueprint, PRD, Roadmap, Spesifikasi Server, & Panduan Sistem
├── docker-compose.yml       # PostgreSQL 16 + PostGIS 3.4, Redis 7, Mailpit
└── package.json             # Konfigurasi NPM Workspaces
```

---

## Spesifikasi Server Host (`DESKTOP-221G8EB`)

- **Model:** Lenovo ThinkStation `30BGS0LK00` (`DESKTOP-221G8EB`)
- **Prosesor:** Intel(R) Xeon(R) CPU E3-1220 v6 @ 3.00GHz (4 Core)
- **Memori:** 32.0 GB RAM @ 2400 MHz (PostgreSQL dituning dengan `shared_buffers=2GB`, `effective_cache_size=6GB`)
- **Penyimpanan:** 1.14 TB (tersisa ±335 GB)
- **GPU:** NVIDIA Quadro P600 (2 GB)
- **Sistem Operasi:** Windows 11 Pro 25H2 (OS Build `26200.6718`)

Detail lengkap perangkat keras dan alokasi memori WSL2 tersedia di [`docs/SERVER-HARDWARE-SPEC.md`](docs/SERVER-HARDWARE-SPEC.md).

---

## Cara Menjalankan Aplikasi

### 1. Prasyarat
- PHP 8.3+ dengan ekstensi `pdo_pgsql`, `pgsql`, `fileinfo`, `gd`, `intl`, `mbstring`.
- Node.js 22+.
- PostgreSQL 16 dengan PostGIS 3.4.
- Redis (opsional atau native Laragon).

### 2. Backend (Laravel 11)
```bash
cd apps/api
composer install
cp .env.example .env     # Sesuaikan koneksi DB
php artisan migrate
php artisan db:seed
php artisan serve
```

### 3. Frontend PWA (React 19)
```bash
cd apps/web
npm install
npm run dev              # Mode development
npm run build            # Build PWA produksi
```

### 4. Sinkronisasi Tipe OpenAPI
```bash
npm run sync-types       # Mengekspor skema OpenAPI dari Laravel dan mengompilasi TypeScript definitions
```

---

## Kredensial Pengujian Standar

| Peran | Email | Kata Sandi |
| :--- | :--- | :--- |
| **Superadmin** | `superadmin@jagapadi.test` | `password` |
| **Admin** | `admin@jagapadi.test` | `password` |
| **Operator** | `operator@jagapadi.test` | `password` |
| **Statistisi** | `statistisi@jagapadi.test` | `password` |
| **Petugas Lapangan** | `petugas@jagapadi.test` | `password` |
| **Viewer** | `viewer@jagapadi.test` | `password` |

---

## Pengujian & Kualitas Kode

Sistem mematuhi standar *quality gate* yang ketat:
- **Backend Tests:** `cd apps/api && php artisan test` (63 tests, 332 assertions, 100% lulus)
- **PHPStan Static Analysis:** `cd apps/api && composer analyse` (0 error)
- **Laravel Pint (Lint):** `cd apps/api && composer lint` (lulus)
- **Frontend Typecheck:** `npm run typecheck` (0 error)
- **Frontend Lint:** `npm run lint` (0 error/warning)
- **Frontend Unit Tests:** `cd apps/web && npm test` (3/3 lulus)

---

## Dokumentasi Lengkap

Lihat panduan terinci pada folder `docs/`:
- **[`docs/DOKUMENTASI_SISTEM_V3.md`](docs/DOKUMENTASI_SISTEM_V3.md)** — **Dokumentasi Utama Sistem & Integrasi BPS Jember**
- [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) — Arsitektur & model data terpadu
- [`docs/PRD.md`](docs/PRD.md) — Matriks RBAC & spesifikasi 6 domain laporan
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Rencana eksekusi Fase 0 s.d. Fase 5
