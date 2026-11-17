# Dokumentasi Sistem Terpadu JAGAPADI v3 (Kabupaten Jember — 3509)

**JAGAPADI (Jember Agrikultur Gapai Prestasi Digital) v3** adalah platform modern pelaporan dan analitik geospasial pertanian terintegrasi untuk Kabupaten Jember (`3509`). Dikembangkan untuk menjembatani kebutuhan operasional Dinas Pertanian dan Badan Pusat Statistik (BPS) Kabupaten Jember dalam pengumpulan fenomena pertanian (KSA, Ubinan, PDRB Pertanian, dan Ketahanan Pangan).

---

## 1. Arsitektur Sistem

Platform dibangun dengan arsitektur Monorepo:
* **Backend API (`apps/api`):** Laravel 11 (PHP 8.3 LTS), RESTful API, Spatie Permission (RBAC), Spatie Activitylog (Audit Log), Scramble OpenAPI 3.1 generator.
* **Frontend Web & PWA (`apps/web`):** React 19, TypeScript, Vite, Tailwind CSS, React Query (@tanstack), Leaflet / React-Leaflet, Offline-first IndexedDB PWA.
* **Shared Types (`packages/shared`):** Auto-generated TypeScript types langsung dari kontrak OpenAPI backend (`openapi-typescript`).
* **Basis Data Spasial:** PostgreSQL 16 + PostGIS 3.4 untuk pemetaan koordinat, poligon kecamatan, desa, 16.543 SLS (Satuan Lingkungan Setempat), dan kluster spasial wabah.
* **Cache & Memory Store:** Redis 7 untuk akselerasi query spasial dan caching ringkasan fenomena.

```
new-jagapadi-3509/
├── apps/
│   ├── api/                 # Laravel 11 + PostGIS + RBAC + Audit Log + Notifikasi
│   └── web/                 # React 19 PWA + Leaflet + Tailwind + Offline IndexedDB
├── packages/
│   └── shared/              # openapi.json & src/api-types.d.ts
├── docs/                    # Dokumentasi teknis, PRD, Blueprint, dan Panduan
├── tools/                   # Sinkronisasi data MFD / SLS BPS Jember
└── package.json             # NPM Workspaces (@jagapadi/web, @jagapadi/shared)
```

---

## 2. Matriks Hak Akses & Peran Pengguna (RBAC)

Sistem menerapkan prinsip *Least Privilege* dengan 6 tingkatan peran:

| Peran | Deskripsi Pengguna | Menu Utama | Hak Akses Utama |
| :--- | :--- | :--- | :--- |
| **Superadmin** | Administrator Tertinggi Sistem & TI | Semua Menu | Bypass otorisasi sistem, kelola seluruh admin/user, konfigurasi global. |
| **Admin** | Administrator Dinas / Tim Inti BPS | Beranda, Peta, Laporan, Fenomena, Wilayah, OPT, Pengguna, Audit Log, Status | Kelola akun (kecuali superadmin), verifikasi/tolak laporan, ekspor fenomena, audit trail. |
| **Operator** | Operator Data & Verifikator Lapangan | Beranda, Peta, Laporan, Fenomena, Wilayah, OPT, Status | Menyetujui/menolak laporan, mengarsipkan laporan, menyetujui usulan OPT baru. |
| **Statistisi** | Fungsional Statistisi BPS (PDRB/KSA) | Beranda, Peta, Laporan, Fenomena, Wilayah, OPT, Status | Read-only analitik, monitoring fenomena spasial, ekspor narasi & matriks BPS, deteksi anomali KSA. |
| **Petugas** | Mitra Statistik BPS / PPL Lapangan | Beranda, Peta, Laporan Saya, Usulan OPT, Akun | Input laporan 6 domain, upload foto lapangan, usulkan OPT baru, ubah kata sandi. *(Akses disaring ketat: tidak dapat melihat menu admin, pengguna, atau audit log)* |
| **Viewer** | Tamu / Peninjau Publik Terdaftar | Beranda, Peta, Laporan Publik | Melihat sebaran peta dan laporan terverifikasi tanpa hak mutasi data. |

---

## 3. Cakupan 6 Domain Laporan Pertanian

Petugas di lapangan dapat melaporkan 6 domain kondisi pertanian:

1. **Hama & Penyakit (OPT / Pest):**
   * Pilihan OPT dari Master Katalog (Hama, Penyakit, Gulma).
   * Tingkat intensitas: Ringan, Sedang, Berat, Puso.
   * Estimasi luas terserang (ha) dan luas terancam (ha).
   * Gejala serangan dan foto dokumentasi lapangan.
2. **Kondisi Irigasi (Irrigation):**
   * Kondisi fisik: Baik, Rusak Ringan, Rusak Sedang, Rusak Berat.
   * Debit air: Melimpah, Cukup, Kurang, Kering.
   * Sumber air: Saluran Irigasi Teknis, Sungai, Sumur Bor, Air Hujan, Waduk/Embung.
3. **Ketersediaan Pupuk (Fertilizer):**
   * Kategori: Bersubsidi vs Non-Subsidi.
   * Jenis pupuk: Urea, NPK Phonska, SP-36, ZA, Organik.
   * Status ketersediaan: Melimpah, Cukup, Langka, Kosong.
   * Harga pasar aktual vs HET (Harga Eceran Tertinggi).
4. **Panen & Ubinan (Harvest):**
   * Komoditas: Padi, Jagung, Kedelai, Tembakau, Tebu, Edamame, Hortikultura, dll.
   * Luas panen (ha).
   * Berat ubinan standar BPS ($2,5 \times 2,5\text{ meter}$) dalam kilogram.
   * Perhitungan produktivitas otomatis: $\text{Produktivitas (ku/ha)} = \frac{\text{Berat Ubinan (kg)} \times 160}{100}$.
5. **Kondisi Cuaca & Iklim (Weather):**
   * Kondisi cuaca: Cerah, Hujan Ringan, Hujan Lebat, Banjir, Angin Kencang, Kekeringan.
   * Suhu udara (°C) dan curah hujan harian (mm).
   * Taksiran dampak terhadap pertanaman.
6. **Alat & Mesin Pertanian (Equipment / Alsintan):**
   * Kategori: Traktor Roda 2/4, Combine Harvester, Pompa Air, Transplanter, Dryer.
   * Jumlah unit dan status kelayakan (Baik, Rusak Ringan, Rusak Berat).
   * Status kepemilikan: Poktan, Gapoktan, UPJA, Perseorangan, Dinas.

---

## 4. Fitur Khusus BPS untuk Pengumpulan Fenomena

### 4.1 Konteks Statistik BPS pada Laporan
Setiap laporan lapangan dilengkapi atribut statistik standar BPS:
* **Komoditas Terkait:** Komoditas spesifik yang terdampak.
* **Kode Segmen KSA:** Nomor identifikasi segmen amatan KSA (contoh: `KSA-3509-01`).
* **Fase Amatan KSA:** Persiapan Lahan, Vegetatif Awal, Vegetatif Akhir, Generatif, Panen, Puso, Bera.
* **Subround & Triwulan:** Terhitung otomatis dari tanggal kejadian:
  * Subround 1 (Jan–Apr) | Subround 2 (Mei–Agu) | Subround 3 (Sep–Des).
  * Triwulan I s.d. IV.
* **Kategori Dampak Statistik:** Menandai apakah peristiwa berpengaruh terhadap:
  * PDRB Pertanian (Nilai Tambah Bruto Tanaman Pangan/Perkebunan).
  * Survei KSA (Luas Panen / Potensi Gagal Panen).
  * Survei Ubinan (Produktivitas / Anomali Hasil).
  * Stabilitas Pasokan & Inflasi Daerah.

### 4.2 Matriks Fenomena & Generator Narasi Otomatis
Halaman `/fenomena` merangkum seluruh anomali lapangan per kecamatan dalam matriks terstruktur:
* **Narasi Otomatis:** Narasi analitik komprehensif yang siap disalin (*one-click copy*) langsung ke rilis Berita Resmi Statistik (BRS) atau laporan Fenomena Triwulanan BPS.
* **Ekspor CSV Berstandar:** Dilengkapi UTF-8 Byte Order Mark (BOM) agar format tabel dan teks Indonesia terbaca sempurna saat dibuka langsung di Microsoft Excel.

### 4.3 Integrasi Referensi KSA Bulanan & Deteksi Anomali Blank-Spot
Sistem memuat tabel referensi `ksa_monthly` (341 amatan bulanan untuk 31 kecamatan se-Kabupaten Jember):
* Menghitung total luas panen dan puso KSA per subround/tahun.
* **Deteksi Anomali Blank-Spot:** Secara otomatis menandai kecamatan yang dalam data KSA tercatat mengalami puso/gagal panen, namun belum ada satupun laporan dari petugas lapangan. Ini memandu BPS/PPL untuk segera melakukan verifikasi lapangan.

### 4.4 Geocoding Spasial & SLS Search
* **Reverse-Geocoding Otomatis:** Endpoint `/api/regions/locate` memetakan koordinat GPS laporan ke Kecamatan, Desa, dan SLS (Satuan Lingkungan Setempat) terdekat secara instan menggunakan rumus Haversine & Bounding Box spasial.
* **Pencarian SLS Fleksibel:** Mendukung variasi pencarian nomor RT/RW masyarakat lokal (misal: `"001"`, `"rt 01"`, `"rw 02"`).

### 4.5 Kluster Outbreak Spasial
Endpoint `/api/pest-clusters` mengelompokkan laporan serangan hama berat dalam radius 1,5 km dan rentang waktu tertentu, menghasilkan format GeoJSON poligon untuk peringatan dini potensi ledakan hama (*pest outbreak*).

---

## 5. Fitur Penunjang & Tata Kelola

### 5.1 Sistem Audit Log Terintegrasi (`/audit-logs`)
* Menggunakan Spatie Activitylog.
* Mencatat pelaku (*causer*), target (*subject*), jenis modul, event, alamat IP, dan perubahan atribut.
* Dilengkapi antarmuka frontend dengan filter modul, event, dan pencarian deskripsi.

### 5.2 Manajemen Akun & Enforced First-Login Guard
* Pengguna dapat mengubah profil dan kata sandi mandiri di `/akun`.
* Akun baru yang dibuat oleh admin dengan bendera `must_change_password: true` secara otomatis dicegat (*intercepted*) dan dipaksa mengganti kata sandi terlebih dahulu sebelum dapat mengakses fitur lainnya.

### 5.3 Sistem Notifikasi In-App
* Ikon lonceng di navbar dengan penghitung notifikasi belum dibaca (*unread count badge*).
* Notifikasi instan saat laporan disubmit, diverifikasi, atau ditolak (beserta catatan perbaikan dari verifikator).

### 5.4 Usulan & Katalog Master OPT (`/opts`)
* Memisahkan tab *Katalog OPT Aktif* dan *Usulan Lapangan*.
* Petugas dapat mengusulkan OPT baru jika menemukan spesies yang belum terdaftar di katalog.
* Operator/Admin dapat menyetujui usulan (otomatis menerbitkan Master OPT aktif dengan kode baru) atau menolaknya dengan alasan.

### 5.5 PWA & Offline-First Field Work
* Aplikasi dapat diinstal ke perangkat Android/iOS/Desktop sebagai Progressive Web App (PWA).
* Mendukung penyimpanan draf offline di IndexedDB dan sinkronisasi otomatis saat terhubung kembali ke jaringan internet.
* Ekstraksi metadata foto GPS otomatis via modul EXIF lapangan.

---

## 6. Verifikasi & Prosedur Pengujian Kualitas

Proyek ini menjaga standar *clean code* dan reliabilitas tinggi tanpa kompromi:

| Suite Pengujian | Perintah | Target Mutu |
| :--- | :--- | :--- |
| **Backend Feature & Unit Tests** | `php artisan test` | 63 tests, 332 assertions, **100% PASS** |
| **PHPStan (Static Analysis)** | `composer analyse` | Level Max, **0 errors** |
| **Laravel Pint (Linting)** | `composer lint` | PSR-12 Standard, **Clean** |
| **TypeScript Typecheck** | `npm run typecheck` | Web & Shared workspace, **0 errors** |
| **Frontend Unit Tests** | `npm test` | Vitest, **100% PASS** |
| **Frontend ESLint** | `npm run lint` | ESLint 9 flat config, **0 warnings/errors** |
| **OpenAPI Contract Sync** | `npm run sync-types` | Sinkronisasi tipe otomatis dari Laravel ke React |
| **Production PWA Build** | `npm run build` | Vite build + Service Worker Workbox, **Clean** |

---

## 7. Kredensial Pengujian Standar (Database Seeder)

Untuk keperluan pengujian lokal, seeder menyediakan akun terstandar:

* **Superadmin:** `superadmin@jagapadi.test` / `password`
* **Admin:** `admin@jagapadi.test` / `password`
* **Operator:** `operator@jagapadi.test` / `password`
* **Statistisi:** `statistisi@jagapadi.test` / `password`
* **Petugas Lapangan:** `petugas@jagapadi.test` / `password`
* **Viewer:** `viewer@jagapadi.test` / `password`
