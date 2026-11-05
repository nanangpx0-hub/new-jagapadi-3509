# JAGAPADI v3 — Roadmap & Rencana Fase

> Status: **DISETUJUI (Baseline Fase 0)**
> Tanggal: 2026-11-02
> Terkait: `docs/BLUEPRINT.md`, `docs/PRD.md`

Roadmap ini bersifat **berurutan & inkremental**. Setiap fase menghasilkan sistem yang
dapat dijalankan (tidak ada fase "setengah jalan"). Estimasi waktu sengaja tidak
dicantumkan — fokus pada cakupan & definisi selesai.

---

## Ringkasan Fase

| Fase | Fokus | Hasil utama |
|---|---|---|
| **0** | Pondasi & tooling | Monorepo, Docker (PG16+PostGIS, Redis), scaffold PHP 8.3 & React 19 PWA, OpenAPI sync, CI |
| **1** | Auth + Master Data | Login, RBAC 5 role, wilayah (PostGIS + normalisasi BPS), OPT |
| **2** | Laporan inti + PWA | Hama & irigasi (draf→verifikasi), validasi spasial `ST_Contains`, offline draft, kompresi WebP |
| **3** | Dashboard & Analitik | KPI, grafik, peta sebaran PostGIS, KSA/BPS, ekspor |
| **3.5** | Kanal publik & komunikasi *(amandemen 2026-11-05)* | Website Publik: beranda hero, 4 kategori, Peta Kejadian read-only, Pembaruan Diverifikasi tanpa PII, CTA → PWA petugas |
| **4** | Data eksternal & tambahan | Usulan OPT, 4 domain laporan sisa, klimatologi, harga, queue scraper, IoT |
| **5** | Hardening & rilis | Observability, backup/restore drill, DAST, deployment VPS, UAT/SUS |

---

## FASE 0 — Pondasi & Tooling

**Deliverable**
- Struktur monorepo: `apps/api`, `apps/web`, `packages/shared`, `docker`, `docs`.
- `docker-compose.yml`: PostgreSQL 16 + PostGIS, Redis 7, Mailpit, PHP 8.3-FPM, Nginx.
- Scaffold Laravel 11 (PHP 8.3): sanctum, spatie/laravel-permission, spatie/laravel-activitylog, dedoc/scramble (OpenAPI), larastan, pest, pint.
- Scaffold React 19 + TS + Vite: Tailwind, shadcn/ui, TanStack Query, react-router, `vite-plugin-pwa`.
- Pipeline kontrak tipe otomatis: `dedoc/scramble` export → `openapi-typescript` di `packages/shared`.
- Konfigurasi kualitas: `strict_types=1` (PHP), `strict` (TS), ESLint, Prettier.
- CI: lint → static analysis → OpenAPI contract check → test → build.
- `.env.example` untuk api & web; README cara menjalankan lokal.

**Definisi Selesai**
- [ ] `docker compose up` menyalakan DB (dengan ekstensi `postgis` aktif) + Redis tanpa error.
- [ ] `apps/api` & `apps/web` menyala lokal dan saling terhubung lewat `/api/health` (cek DB, PostGIS, Redis, Storage).
- [ ] Perintah sinkronisasi tipe OpenAPI (`npm run sync-types`) berhasil men-generate tipe TypeScript di `packages/shared`.
- [ ] CI hijau pada commit pertama.

---

## FASE 1 — Autentikasi + Master Data  ⭐ PRIORITAS SETELAH FASE 0

**Deliverable**
1. **Auth & RBAC**
   - Migration: `users`, `roles`, `permissions`, `model_has_roles`, `role_has_permissions`,
     `sessions`, `password_reset_tokens`, `activity_log`.
   - 5 role: `admin`, `operator`, `statistisi`, `petugas`, `viewer` (pimpinan) + permission matrix sesuai `docs/PRD.md`.
   - Endpoint: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`,
     `POST /auth/change-password`, `POST /auth/reset-password` (admin),
     `GET/POST/PUT/DELETE /users`, `PATCH /users/{id}/toggle-active`.
   - Middleware & Policy; rate limit login; force-change-password; audit log.
   - UI: login, ganti password, daftar/form pengguna.
2. **Master Wilayah (PostGIS)**
   - Migration: `provinces`, `regencies`, `districts`, `villages` (+kolom `geom MultiPolygon` & `centroid Point` PostGIS, index GIST).
   - Impor data Kabupaten Jember (`3509`) dari dump lama + normalisasi kode BPS 10 digit + laporan validasi.
   - CRUD + audit; komponen dropdown wilayah bertingkat.
3. **Master OPT**
   - Migration: `opts`; impor bersih dari `master_opt` lama.
   - CRUD + upload foto aman (konversi otomatis ke WebP) + aktif/nonaktif.

**Definisi Selesai**
- [ ] Admin login, kelola pengguna (5 role), kelola wilayah & OPT end-to-end.
- [ ] Petugas login & hanya bisa mengakses modul sesuai matriks RBAC.
- [ ] Semua mutasi tercatat di `activity_log`.
- [ ] Test: unit + feature (kasus role negatif) hijau; CI hijau.

---

## FASE 2 — Laporan Inti (Hama & Irigasi) & Kemampuan Lapangan (PWA)

**Deliverable**
- Migration tabel laporan terpadu: `reports` (termasuk `geom` & `is_coordinate_mismatch`), `report_pest_details`,
  `report_irrigation_details`, `report_photos`, `report_videos`, `report_status_histories`,
  `report_number_counters`.
- Service pipeline status (`draf` → `submitted` → `verified` → `rejected` → `archived` / `resubmitted`).
- Validasi geospasial silang di `ReportService`: cek `ST_Contains(village.geom, report.geom)` saat submit untuk menandai `is_coordinate_mismatch` jika titik GPS di luar poligon desa/kecamatan pilihan.
- Nomor laporan atomic (unique constraint + retry pada saat transisi ke `submitted`).
- Pemrosesan media: kompresi gambar client-side di browser + re-encode server-side ke WebP (maks lebar 1280px) via `Storage::disk()`.
- Penyimpanan draf lokal (`IndexedDB`) pada Web PWA agar petugas lapangan dapat menyimpan draf saat sinyal lemah dan melakukan submit saat kembali online.
- UI: daftar (filter/keyset pagination), form (draf lokal, draf server & submit), detail, antrian verifikasi (menampilkan badge peringatan jika `is_coordinate_mismatch = true`).
- Peta dasar lokasi laporan (MapLibre/Leaflet).

**Definisi Selesai**
- [ ] Petugas membuat draf (baik online maupun via penyimpanan lokal PWA) → submit dengan foto terkompresi & koordinat GPS.
- [ ] Sistem otomatis mendeteksi dan memberi flag `is_coordinate_mismatch` bila koordinat berada di luar batas desa pilihan.
- [ ] Admin/Statistisi/Operator sesuai hak akses melakukan verifikasi/tolak (alasan wajib) → petugas resubmit.
- [ ] Aturan status ditegakkan di server (draf tak bisa diverifikasi; petugas tak bisa ubah status verifikasi).
- [ ] Statistik default tidak menyertakan draf maupun laporan ditolak.

---

## FASE 3 — Dashboard & Analitik

**Deliverable**
- KPI cards, grafik tren (per status/tipe/wilayah/waktu), filter `include_draft`.
- Peta sebaran interaktif (clustering, choropleth/layer batas kecamatan/desa PostGIS, filter wilayah).
- Impor & tampilan data KSA bulanan (2018–2026) + data pertanian BPS.
- Evaluasi akurasi (estimasi internal vs rilis BPS).
- Ekspor XLSX/CSV/PDF.
- Cache agregat via Redis + invalidasi otomatis melalui Model Observer/Event saat status laporan berubah.

**Definisi Selesai**
- [ ] Dashboard akurat (angka konsisten dengan data laporan terverifikasi).
- [ ] Peta menampilkan sebaran laporan dan poligon wilayah sesuai filter.
- [ ] Ekspor menghasilkan berkas valid; angka KSA/BPS sesuai sumber.

---

## FASE 3.5 — Kanal Publik & Komunikasi *(amandemen 2026-11-05)*

**Latar:** Pemilik produk menyetujui arah visual dengan permukaan **Website Publik** (lihat `docs/DESIGN.md` v3). Permukaan ini **belum ada** di baseline v3 dan kini diresmikan sebagai fase tersendiri. Data yang tampil ke publik **hanya** laporan berstatus `Diverifikasi` dan agregat per kecamatan — **tanpa PII pelapor** (nama, kontak, atau identitas lain).

**Deliverable**
1. **Beranda publik** (`apps/web`, route group publik):
   - Navbar: wordmark "JAGAPADI — Kabupaten Jember", tautan **Peta Kejadian**, **Panduan**, ikon pencarian.
   - Hero: foto sawah berlisensi (milik sendiri/stock bebas) + headline *"Kenali kondisi sekitar. Laporkan lebih cepat."* + CTA **Buat Laporan** dan **Lihat Peta**.
   - **Pilih Kategori Laporan** (4 kartu penyederhanaan tampilan, dipetakan ke domain PRD): Hama→`pest`, Penyakit→`pest`, Genangan→`irrigation`, Kekeringan→`weather`.
   - Peta Kejadian (read-only): marker per kategori (Hama/Penyakit/Genangan/Kekeringan), filter wilayah kecamatan, atribusi tile; klik marker → ringkas publik (kategori, kecamatan, tanggal, status — tanpa data pribadi).
   - **Pembaruan Kejadian**: feed laporan `Diverifikasi` terkurasi — thumbnail foto, tag kategori, kecamatan, waktu relatif; tanpa nama pelapor.
   - Halaman **Panduan**: cara melapor (mengacu ke PWA petugas), FAQ singkat, kontak BPS 3509.
2. **Akses publik**: tanpa login; **"Buat Laporan" publik diarahkan ke PWA petugas** (login). Tidak ada formulir pengaduan publik bermoderasi pada fase ini (keputusan 2026-11-05).
3. **API publik khusus**: endpoint read-only terkurasi (mis. `GET /api/public/events`, `GET /api/public/stats`) yang hanya mengekspos agregat & laporan Diverifikasi — bukan `/api/reports` penuh. Rate-limit ketat, tanpa data pribadi, `Cache-Control` wajar.
4. **SEO & sosial**: title/meta description, Open Graph image, favicon/ikon konsisten, `sitemap.xml`.
5. **Keamanan publik**: audit endpoint (tidak ada field PII ter-expose), CSP, dan uji akses tanpa kredensial.

**Definisi Selesai**
- [ ] Warga tanpa login dapat melihat peta kejadian & pembaruan (hanya data Diverifikasi, tanpa PII).
- [ ] CTA publik mengarahkan ke PWA petugas; tidak ada data transaksi/PII yang bocor (audit endpoint publik).
- [ ] Kontras & responsif lulus (terang; mode gelap mengikuti aturan `docs/DESIGN.md` v3 §3.1b), Lighthouse ≥ 90 untuk performance & accessibility best-practice.
- [ ] Uji dengan 3–5 warga/petani (gerbang validasi `docs/DESIGN.md` §8).

**Keputusan produk terkunci (2026-11-05):** publik = read-only + arahan ke PWA; pemetaan 4 kategori → domain PRD disetujui; Website Publik masuk ROADMAP sebagai Fase 3.5.

---

## FASE 4 — Data Eksternal & Modul Tambahan

**Deliverable**
- Usulan OPT (pengajuan petugas + review admin) + foto + riwayat status.
- 4 domain laporan lanjutan: pupuk (`report_fertilizer_details`), panen (`report_harvest_details`), cuaca (`report_weather_details`), alat & sarana (`report_equipment_details`) di atas tabel `reports` terpadu.
- Data klimatologi (curah hujan, kecepatan angin per centroid kecamatan) + tampilan.
- Harga komoditas + alert fluktuasi.
- Queue-based scraper: BMKG, NASA POWER, BPS, harga (port dari sistem lama ke Laravel Queue Job + Scheduler).
- IoT irigasi (aset, sensor, rule engine) — skema & endpoint siap pakai.

**Definisi Selesai**
- [ ] Semua 6 domain laporan berjalan dengan pipeline status dan validasi spasial yang sama.
- [ ] Scraper berjalan via Redis queue + scheduler (menggunakan koordinat `centroid` masing-masing kecamatan di Jember, bukan koordinat tunggal), dengan log & monitoring.
- [ ] Impor data lama (harga/iklim) tervalidasi.

---

## FASE 5 — Hardening & Rilis

**Deliverable**
- Audit log lengkap & observability (structured log, correlation ID, health check, metrik queue).
- Backup & restore drill (PostgreSQL + PostGIS dump & media volume).
- Uji keamanan (DAST), hardening header/CSP, review hak akses DB/OS.
- Konfigurasi deployment produksi berbasis Docker Compose pada VPS/Dedicated Server.
- Dokumentasi pengguna & admin; panduan operasional.
- UAT & evaluasi SUS dengan pengguna; daftar bug tersisa ditutup.

**Definisi Selesai**
- [ ] Restore drill berhasil; SLO dasar terpantau.
- [ ] Tidak ada temuan kritis dari DAST.
- [ ] Dokumentasi & kesiapan rilis produksi selesai.

---

## Dependensi & Risiko Antar-Fase

| Fase | Bergantung pada | Risiko utama & Mitigasi |
|---|---|---|
| 1 | 0 | Kualitas data wilayah lama → Script normalisasi kode BPS 10 digit & validasi geometri PostGIS |
| 2 | 1 | Koneksi lapangan & akurasi titik GPS → Offline draft PWA (`IndexedDB`), kompresi WebP, & cek `ST_Contains` |
| 3 | 2 | Akurasi KSA/BPS & konsistensi cache → Invalidation terpusat di `ReportService` & pengujian regresi angka |
| 4 | 3 | Scraper bergantung sumber eksternal → Isolasi di Redis Queue dengan retry/backoff & alerting gagal |
| 3.5 | 3 | Risiko bocornya data pribadi / konten tanpa kurasi → Hanya laporan `Diverifikasi`, agregat per kecamatan, endpoint publik read-only terpisah, audit tanpa kredensial |
| 5 | semua | Kesiapan infrastruktur produksi → Standarisasi container Docker sejak Fase 0 |

---

## Keputusan Arsitektur yang Telah Ditetapkan

1. **Hosting**: **VPS / Dedicated Server berbasis Docker** (mendukung penuh PostgreSQL 16 + PostGIS, Redis, dan Laravel Queue Worker).
2. **Penyimpanan Media**: **Local Disk via abstraksi `Storage::disk()` + Kompresi WebP** (disimpan di volume Docker pada Fase 1–3 dengan kompresi otomatis maks lebar 1280px; siap diarahkan ke S3/MinIO tanpa ubah kode).
3. **PHP Runtime Version**: **PHP 8.3 LTS** (stabilitas ekstensi `pdo_pgsql`, `redis`, `gd`/`imagick` pada container).
4. **Cakupan Fase 2**: **Fokus 2 Domain Inti (Hama & Irigasi) + PWA Field Support** (memvalidasi arsitektur tabel laporan terpadu dan validasi spasial sebelum memperluas ke 4 domain sisanya di Fase 4).

---

## Langkah Berikutnya

1. Susun `docs/PRD.md` (matriks permission 5 role & spesifikasi kolom detail ke-6 domain laporan).
2. Mulai eksekusi **Fase 0** (scaffolding monorepo, Docker Compose, Laravel 11, dan React 19 PWA).

---

*Dokumen terkait: `docs/BLUEPRINT.md`, `docs/PRD.md`.*

---

## Amandemen 2026-11-05

- **Penambahan Fase 3.5 — Kanal Publik & Komunikasi**: permukaan **Website Publik** disetujui pemilik produk (baca publik: peta kejadian & pembaruan laporan terverifikasi, tanpa PII; CTA mengarah ke PWA petugas). Rincian brief & token visual: `docs/DESIGN.md` v3. Tidak ada data transaksi baru yang diekspos; API publik dibatasi read-only dan terkurasi.
