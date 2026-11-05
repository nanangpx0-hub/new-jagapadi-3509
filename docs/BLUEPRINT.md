# JAGAPADI v3 — Blueprint Arsitektur (Rebuild)

> Status: **DISETUJUI (Baseline Fase 0)**
> Tanggal: 2026-11-02
> Sistem lama (referensi): `C:\laragon\www\jagapadi-3509`
> Sistem baru: `C:\laragon\www\new-jagapadi-3509`

---

## 1. Ringkasan Eksekutif

JAGAPADI (Jember Agrikultur Gapai Prestasi Digital) adalah sistem pelaporan & analitik
pertanian untuk Kabupaten Jember (`3509`). Proyek lama memiliki fitur kaya tetapi menanggung beban
teknis: dua runtime paralel, routing non-eksplisit, file monolitik, skema database tak
terkelola, dan duplikasi logika pada 6 domain laporan.

Keputusan: **membangun ulang secara menyeluruh (full-stack rewrite)** dengan pondasi modern,
database baru berbasis geospasial (PostGIS), dukungan PWA untuk petugas lapangan, dan **data referensi**
yang tetap diimpor secara bersih dari sistem lama.

---

## 2. Keputusan Kunci

| Aspek | Keputusan | Catatan |
|---|---|---|
| Strategi | Full-stack modern rewrite | Bukan refactor/strangler |
| Backend | Laravel 11 (PHP 8.3 LTS) | Ekosistem matang, kompatibilitas ekstensi Docker stabil |
| Frontend web | React 19 + TypeScript + Vite (PWA) | SPA + PWA (offline draft via IndexedDB & kompresi foto client-side) |
| Kontrak API | OpenAPI auto-generated | `dedoc/scramble` (Laravel) → `openapi-typescript` (`packages/shared`) |
| Database | PostgreSQL 16 + PostGIS | Query spasial untuk peta sebaran & validasi titik koordinat |
| Cache/Queue | Redis | Queue worker untuk import & scraper, cache agregat dashboard |
| Storage Media | Local Disk (`Storage::disk`) + WebP | Volume Docker lokal (Fase 1–3), siap S3/MinIO; kompresi otomatis WebP |
| Auth | Laravel Sanctum (cookie session + CSRF) | JWT/Token disiapkan opsional untuk klien eksternal |
| Data transaksi lama | **Tidak dibawa** (fresh) | Mulai bersih tanpa tabel sampah |
| Mobile | **Digantikan Web PWA** | Tanpa aplikasi Flutter terpisah; dioptimalkan lewat PWA mobile-first |
| Hosting | **VPS / Dedicated Server (Docker)** | Mengakomodasi PostGIS, Redis, dan Queue Worker persisten |
| Role | admin, operator, statistisi, petugas, viewer/pimpinan | 5 role dengan matriks RBAC eksplisit (lihat `docs/PRD.md`) |

---

## 3. Latar Belakang: Mengapa Rebuild

Temuan dari sistem lama yang mendorong rewrite:

1. **Dua runtime aktif** — root legacy (`app/` + `api/`) dan `backend/` v1 berjalan
   bersamaan, menyebabkan drift keamanan & kontrak API.
2. **Routing web non-eksplisit** — URL apa pun dapat memanggil method; tidak default-deny.
3. **File monolitik** — view curah hujan ±3.000 baris, form laporan ±2.300 baris,
   `IrigasiController` 500+ baris.
4. **Skema tumbuh liar** — 67 tabel termasuk tabel backup/sampah
   (`harga_komoditas_duplicate_backup_20260811`, dsb), tanpa migration yang rapi.
5. **Duplikasi 6 domain laporan** — hama, irigasi, pupuk, panen, cuaca, alat-sarana
   memiliki controller/model/view hampir paralel → bug drift.
6. **Aturan bisnis tidak konsisten** — draft ikut statistik, nomor laporan tak digenerate,
   draf bisa diverifikasi.
7. **Bug data** — `OpenMeteoService` memakai koordinat default yang sama untuk seluruh
   kecamatan; regresi test KSA/dashboard.
8. **Keamanan** — `unserialize()` cache tanpa `allowed_classes=false`; file scraper
   standalone di luar middleware.

---

## 4. Arsitektur Target

```
┌───────────────────────────────────────────────────────────────┐
│              Browser (Web Admin & Petugas PWA)                │
│        React 19 + TypeScript + Vite + Tailwind/shadcn         │
│    MapLibre/Leaflet · Recharts · TanStack Query · IndexedDB   │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTPS  (JSON, cookie session + CSRF)
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                  API — Laravel 11 (PHP 8.3)                   │
│  Routes eksplisit · Form Request validation · Policies        │
│  Service layer · Queue (Redis) · Scheduler · Sanctum          │
└──────────┬────────────────────────────────┬───────────────────┘
           │                                │
           ▼                                ▼
┌────────────────────┐          ┌────────────────────────────┐
│  PostgreSQL 16     │          │  Redis                     │
│  + PostGIS         │          │  cache · queue · session   │
└────────────────────┘          └────────────────────────────┘
           ▲
           │ Queue worker: import Excel/KSA, kompresi media, scraper BMKG/BPS/harga
```

### 4.1 Struktur Monorepo

```
new-jagapadi-3509/
├── apps/
│   ├── api/                 # Laravel 11 (PHP 8.3)
│   │   ├── app/
│   │   │   ├── Http/Controllers/Api/
│   │   │   ├── Http/Requests/
│   │   │   ├── Http/Middleware/
│   │   │   ├── Models/
│   │   │   ├── Policies/
│   │   │   ├── Services/
│   │   │   └── Jobs/
│   │   ├── database/migrations/
│   │   ├── database/seeders/
│   │   ├── routes/api.php
│   │   └── tests/
│   └── web/                 # React 19 + TS + Vite (PWA)
│       ├── src/
│       │   ├── app/         # routing, providers
│       │   ├── features/    # per-modul (auth, wilayah, opt, laporan, dashboard)
│       │   ├── components/  # UI reusable
│       │   ├── lib/         # api client, offline sync (IndexedDB), hooks
│       │   └── types/
│       └── tests/
├── packages/
│   └── shared/              # Tipe TypeScript hasil generate OpenAPI (`openapi-typescript`)
├── docker/                  # postgres+postgis, redis, mailpit, nginx, php-fpm
├── docs/                    # blueprint, PRD, roadmap, ERD, kontrak API
├── .editorconfig
└── README.md
```

### 4.2 Prinsip Arsitektur

- **Default-deny routing** — semua endpoint eksplisit & ber-middleware.
- **Thin controller** — logika bisnis di Service, validasi di Form Request, otorisasi di Policy.
- **Satu abstraksi laporan** — 6 domain berbagi satu pipeline status & satu tabel dasar (`Class Table Inheritance`).
- **Validasi Geospasial Silang** — titik koordinat GPS laporan divalidasi terhadap poligon desa/kecamatan pilihan menggunakan PostGIS (`ST_Contains`/`ST_Within`), menghasilkan flag `is_coordinate_mismatch` jika lokasi melenceng.
- **Field-Ready PWA** — kompresi foto di sisi klien sebelum unggah dan penyimpanan draf lokal (`IndexedDB`) untuk mengantisipasi sinyal lemah di area pertanian.
- **Migration append-only** — setiap perubahan skema punya file migration + rollback.
- **Type-safe & Auto-Sync Contract** — `declare(strict_types=1)` (PHP) & `strict` TypeScript; skema OpenAPI digenerate otomatis dari kode Laravel ke `packages/shared`.

---

## 5. Model Data (ERD Konseptual)

### 5.1 Domain & Tabel

**A. Identitas & Akses**
| Tabel | Keterangan |
|---|---|
| `users` | Akun (nama, username, email, password, role, aktif, must_change_password) |
| `roles`, `permissions`, `model_has_roles`, `role_has_permissions` | RBAC (spatie/laravel-permission) |
| `sessions`, `personal_access_tokens`, `password_reset_tokens` | Sesi & token |
| `activity_log` | Audit trail (spatie/laravel-activitylog) |

**B. Master Wilayah (PostGIS)**
| Tabel | Keterangan |
|---|---|
| `provinces` | Provinsi (kode BPS, nama) |
| `regencies` | Kabupaten/kota (kode BPS, nama, province_id, geom) |
| `districts` | Kecamatan (kode BPS, nama, regency_id, geom, centroid) |
| `villages` | Desa/kelurahan (kode BPS, nama, district_id, geom, centroid) |

Kolom `geom geometry(MultiPolygon,4326)` menyimpan poligon batas wilayah; `centroid` menyimpan titik tengah sebagai fallback peta dan perhitungan cuaca.

**C. Master OPT**
| Tabel | Keterangan |
|---|---|
| `opts` | Organisme pengganggu tanaman (nama, jenis hama/penyakit/gulma, ETL, satuan, deskripsi, foto, aktif) |
| `opt_proposals` | Usulan OPT baru dari petugas + riwayat status |
| `opt_proposal_photos` | Foto pendukung usulan |

**D. Laporan (Desain Terpadu)**
| Tabel | Keterangan |
|---|---|
| `reports` | **Tabel dasar semua laporan**: nomor, tipe, pelapor, status, tanggal, wilayah, koordinat, `geom`, `is_coordinate_mismatch`, catatan, verifikasi, timestamps |
| `report_pest_details` | Detail hama (opt_id, tingkat keparahan, luas serangan, luas waspada, populasi, varietas, umur tanaman) |
| `report_irrigation_details` | Detail irigasi (nama saluran, daerah irigasi, jenis kerusakan/masalah, kondisi fisik, debit, luas terdampak) |
| `report_fertilizer_details` | Detail pupuk (jenis, jumlah, dosis, kendala distribusi) |
| `report_harvest_details` | Detail panen (komoditas, varietas, luas panen, hasil ubinan/total, produktivitas, harga jual petani) |
| `report_weather_details` | Detail cuaca (kondisi, suhu, kelembapan, curah hujan lokal, dampak lahan) |
| `report_equipment_details` | Detail alat & sarana (nama/jenis alsintan, jumlah, kondisi, status kepemilikan/poktan) |
| `report_photos`, `report_videos` | Lampiran media (foto dikonversi ke WebP maks 1280px) |
| `report_status_histories` | Riwayat transisi status (aktor, status awal, status akhir, catatan/alasan tolak) |
| `report_number_counters` | Counter nomor laporan atomic per prefix per tanggal |

> Rasional: 6 domain berbagi alur status & kolom umum → hindari duplikasi. Detail spesifik
> disimpan di tabel detail 1:1. Ini menggantikan pendekatan lama yang menduplikasi
> controller/model/view per domain.

**E. Data Referensi & Analitik**
| Tabel | Keterangan |
|---|---|
| `ksa_monthly` | Data KSA bulanan (kabupaten/kecamatan, tahun, bulan, fase amatan, luas panen, produksi) |
| `bps_agriculture` | Data pertanian rilis BPS (produksi, luas panen, produktivitas) |
| `commodity_prices` | Harga komoditas (GKP, GKG, beras medium/premium, jagung, dsb) |
| `rainfall_observations` | Curah hujan per kecamatan/tanggal |
| `wind_observations` | Kecepatan angin |
| `tags`, `taggables` | Tagging laporan |
| `notifications` | Notifikasi in-app |

**F. IoT Irigasi (fase lanjut)**
| Tabel | Keterangan |
|---|---|
| `irrigation_assets` | Aset irigasi (saluran, bendungan) |
| `sensor_readings` | Pembacaan sensor |
| `irrigation_rules`, `irrigation_rule_logs` | Rule engine & log |

### 5.2 Aturan Bisnis Status Laporan

```
Draf ──submit──► Submitted ──verifikasi──► Diverifikasi ──arsip──► Diarsipkan
                    │
                    └──tolak──► Ditolak ──resubmit──► Submitted

1. Nomor laporan dibangkitkan HANYA saat status menjadi Submitted (pertama kali).
2. Saat Submit, PostGIS memeriksa ST_Contains(village.geom, report.geom) -> set is_coordinate_mismatch.
3. Statistik default TIDAK menyertakan Draf maupun Ditolak (hanya Submitted/Diverifikasi sesuai filter).
4. Draf tidak boleh diverifikasi langsung (validasi wajib di server).
```

---

## 6. Strategi Data Referensi (Impor dari Sistem Lama)

Meski data transaksi dibuat fresh, data berikut **diimpor** dari `C:\laragon\www\jagapadi-3509`:

| Data | Sumber di sistem lama | Metode |
|---|---|---|
| Master wilayah Jember | `master_provinsi`, `master_kabupaten`, `master_kecamatan`, `master_desa` + GeoJSON batas wilayah | Seeder/import script, normalisasi kode BPS 10 digit |
| Master OPT | `master_opt` | Seeder/import script |
| KSA bulanan | `data_ksa_bulanan` + `data/ksa/*.xlsx` (2018–2026) | Import Excel → `ksa_monthly` |
| Data pertanian BPS | `data_pertanian_bps` + `data/ksa/data_pertanian_bps_2025.csv` | Import CSV → `bps_agriculture` |
| Harga komoditas | `harga_komoditas` | Import tervalidasi |
| Curah hujan & angin | `curah_hujan`, `kecepatan_angin` | Import (opsional, untuk analitik historis) |

Catatan:
- Data lama **dibersihkan** saat impor (buang duplikat, tabel backup, kolom tak terpakai).
- Setiap impor bersifat idempoten dan menghasilkan laporan validasi (jumlah baris,
  baris gagal, alasannya).

---

## 7. Keamanan

| Aspek | Implementasi |
|---|---|
| Autentikasi | Laravel Sanctum; session cookie HttpOnly + SameSite, CSRF untuk SPA |
| Otorisasi | RBAC (spatie) + Policy per-resource; ownership check untuk petugas |
| Input | Form Request validation; cast tipe eksplisit |
| SQL | Eloquent/Query Builder parameterized; identifier allowlist |
| Upload | Validasi magic bytes + MIME + ekstensi, re-encode ke WebP, nama file UUID, direktori non-executable |
| XSS | React auto-escaping; sanitasi konten kaya bila ada |
| Audit | `activity_log` untuk login, CRUD, verifikasi, perubahan master |
| Rate limit | Throttle per-IP per-endpoint (login, submit, API publik) |
| Headers | CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy |
| Secret | Hanya via `.env`, tidak pernah di-commit; `APP_DEBUG=false` di produksi |

---

## 8. Non-Functional

- **Performa**: index GIST pada kolom `geom`, composite B-Tree index pada kolom filter (`status`, `report_date`, `district_id`, `report_type`); keyset pagination untuk daftar besar; cache terpusat (Redis) untuk agregat dashboard.
- **Observability**: structured logging + correlation ID; health check endpoint (`/api/health` memeriksa DB, PostGIS, Redis, Storage).
- **CI/CD**: lint (Pint/ESLint), static analysis (PHPStan/Larastan, `tsc`), kontrak OpenAPI sync check, test (Pest/Vitest), build gate sebelum merge.
- **Backup**: dump PostgreSQL harian (`pg_dump` custom format) + backup media upload.
- **i18n & waktu**: Bahasa Indonesia, timezone `Asia/Jakarta`, format tanggal konsisten.
- **Aksesibilitas**: target WCAG 2.1 AA pada komponen inti & kontras tinggi untuk penggunaan luar ruang (outdoor).

---

## 9. Di Luar Lingkup (Fase Ini)

- Aplikasi mobile native/Flutter terpisah (digantikan oleh kemampuan PWA pada `apps/web`).
- Migrasi data transaksi laporan lama (mulai fresh).
- IoT/sensor perangkat keras di lapangan (skema disiapkan di Fase 4, integrasi perangkat keras menyusul).

---

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Koneksi internet petugas di sawah tidak stabil | Fitur offline draft (`IndexedDB`) di PWA + kompresi gambar di browser sebelum upload |
| Titik GPS laporan tidak sesuai desa pilihan | Validasi PostGIS `ST_Contains` otomatis memberi tanda `is_coordinate_mismatch` untuk verifikator |
| Drift tipe data antara Laravel & React | Generasi tipe TypeScript otomatis dari spesifikasi OpenAPI Laravel (`dedoc/scramble`) |
| Kehilangan logika scraper yang sudah berjalan | Port ulang bertahap ke Laravel Queue Job di Fase 4; sistem lama tetap jadi referensi |
| Kualitas data referensi lama jelek | Script validasi + laporan impor sebelum masuk produksi |
| Scope creep (67 tabel lama) | Kunci fase prioritas; hanya bawa modul yang disetujui |

---

---

## Amandemen 2026-11-05 — Website Publik (Fase 3.5)

Pemilik produk menyetujui penambahan permukaan **Website Publik** di samping Web Admin & PWA Lapangan: beranda dengan hero + 4 kategori penyederhanaan (Hama→`pest`, Penyakit→`pest`, Genangan→`irrigation`, Kekeringan→`weather`), Peta Kejadian read-only, dan pembaruan laporan `Diverifikasi` terkurasi **tanpa PII**. CTA "Buat Laporan" mengarahkan ke PWA petugas (tanpa formulir publik bermoderasi). Terdaftar sebagai **Fase 3.5** di `docs/ROADMAP.md`; brief & sistem token UI: `docs/DESIGN.md` v3. Arsitektur dan keamanan lain dari blueprint ini tidak berubah.

*Dokumen terkait: `docs/PRD.md` (persyaratan produk & matriks RBAC), `docs/ROADMAP.md` (rencana fase).*
