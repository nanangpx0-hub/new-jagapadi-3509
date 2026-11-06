# JAGAPADI v3 — Backend API (`apps/api`)

Laravel 11 (PHP 8.3) REST API untuk Sistem Pelaporan & Analitik Pertanian Kabupaten Jember (BPS 3509).

## Prasyarat
- PHP 8.3, Composer 2.8+
- Docker Desktop (PostgreSQL 16 + PostGIS 3.4, Redis 7, Mailpit) — lihat `docker-compose.yml` di root repo
- Node.js ≥ 22 (untuk `packages/shared`)

## Menjalankan (dev lokal)

```powershell
cd C:\laragon\www\new-jagapadi-3509

# 1. Infrastruktur
docker compose up -d

# 2. Backend
cd apps/api
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force          # Role, user demo, wilayah BPS 3509, OPT pangan, SLS, dummy laporan
php artisan storage:link
php artisan serve                    # http://127.0.0.1:8000
```

Endpoint health check: `GET http://127.0.0.1:8000/api/health` → JSON `{status:"ok", checks:{database,postgis,redis,storage}}`.

## Perintah pengembangan

```powershell
cd apps/api
composer lint            # Pint (code style)
composer analyse         # Larastan level 5
composer test            # PHPUnit (feature tests berjalan di atas PostgreSQL+PostGIS sungguhan)
composer openapi:export  # ekspor OpenAPI -> packages/shared/openapi.json
```

Sinkronisasi kontrak TypeScript (jalankan dari root repo):

```powershell
npm run sync-types        # php artisan scramble:export + openapi-typescript
npm run typecheck         # shared + web
npm run lint              # web eslint
npm run test              # web vitest
npm run build             # web vite build (PWA + SW)
```

## Akun demo (password: `password`)
- `admin@jagapadi.test` (admin) · `operator@jagapadi.test` (operator) · `statistisi@jagapadi.test` (statistisi)
- `petugas@jagapadi.test` (petugas) · `viewer@jagapadi.test` (viewer)

## Catatan penting
- Autentikasi: Sanctum **cookie session (HttpOnly) + CSRF** untuk SPA, plus bearer token opsional untuk klien eksternal (lihat `app/Http/Controllers/Api/AuthController.php`).
- Data wilayah resmi BPS 3509 dihasilkan oleh `tools/sync_mfd_data.py` dari `data/MFD/sls_3509_sudah_validasi_disolve_fill gap.xlsx`.
- Data transaksi laporan dimulai bersih (fresh); hanya data referensi (wilayah, OPT, SLS) yang diimpor.