# Batas administrasi Jember: sumber, ekstraksi, impor, dan validasi

## Status dan batasan verifikasi

Workspace menggunakan Laravel 11. Berkas yang ditambahkan:

- `apps/api/database/jember_gis.sql`: skema PostGIS dan fungsi validasi laporan.
- `apps/api/database/seeders/JemberBoundarySeeder.php`: impor GeoJSON ternormalisasi dalam satu transaksi.
- Dokumen ini: panduan sumber, query Overpass, kontrak input, serta langkah pengujian.

Belum ada dataset yang diunduh, lisensi yang diverifikasi, SQL yang dijalankan, ataupun koneksi database yang diubah. Sesuai instruksi, tidak dilakukan pencarian web. Karena itu, daftar berikut merupakan kandidat sumber, BUKAN pernyataan bahwa suatu dataset tertentu telah terverifikasi resmi, berlisensi terbuka, atau lengkap.

Target pengguna adalah 31 kecamatan dan 248 desa/kelurahan. Cocokkan jumlah, status desa versus kelurahan, kode, dan tanggal referensi dengan register resmi bertanggal. Jangan menjadikan jumlah tersebut sebagai bukti bahwa geometri lengkap atau benar.

## 1. Sumber dan pemeriksaan lisensi

### Kandidat sumber resmi

1. BIG / Ina-Geoportal: https://tanahair.indonesia.go.id/
   Cari layer batas administrasi kecamatan dan desa/kelurahan, kemudian baca metadata produsen, tanggal, skala, status penegasan batas, CRS, lisensi, dan pembatasan distribusi. Jangan menganggap akses unduh atau endpoint WMS/WFS berarti lisensi terbuka. Akses Kebijakan Satu Peta juga tidak otomatis berarti izin redistribusi.
2. BPS: https://www.bps.go.id/ dan BPS Kabupaten Jember https://jemberkab.bps.go.id/
   Gunakan register/publikasi wilayah sebagai rujukan kode BPS dan rekonsiliasi jumlah. Peta wilayah kerja statistik tidak otomatis sama dengan batas administrasi yang berkekuatan hukum. Ketersediaan poligon serta hak penggunaannya harus diperiksa per produk.
3. Kemendagri: https://www.kemendagri.go.id/
   Gunakan register wilayah sebagai rujukan administratif dan kode Kemendagri. Kode Kemendagri bukan kode BPS; gunakan crosswalk yang memiliki tahun referensi, bukan sekadar mengganti titik atau memotong digit.
4. Repositori bernama `batas-administrasi-indonesia`: nama saja tidak cukup untuk menentukan pemilik atau memverifikasi repositori. Periksa URL pemilik, commit/tag, asal data, LICENSE, serta apakah lisensi mencakup DATA, bukan hanya kode program. Dokumen ini tidak mengklaim repositori tertentu sudah diverifikasi.

Tidak ada dataset resmi berlisensi terbuka yang dapat disertifikasi dari hasil inspeksi workspace saja. Sebelum produksi, simpan URL layer, judul, produsen, tanggal unduh, tahun referensi, teks lisensi, atribusi, dan checksum berkas. Jika syarat penggunaan tidak eksplisit, minta klarifikasi pemilik; jangan menandainya sebagai open data.

### Alternatif terbuka, bukan batas resmi

OpenStreetMap merupakan data komunitas, bukan pengganti penetapan batas oleh pemerintah. Rujukan lisensi OSM: https://www.openstreetmap.org/copyright . Periksa kewajiban ODbL, atribusi, serta ketentuan distribusi database turunan sebelum publikasi. Geometri OSM dan kode BPS tetap memerlukan rekonsiliasi; jumlah relasi tidak dijamin 31/248.

## 2. Overpass Turbo: temukan wilayah induk terlebih dahulu

Buka Overpass Turbo dan jalankan query pemeriksaan ini. Query memakai nama geografis, bukan menganggap kode BPS 3509 sebagai ID area atau ID relasi OSM.

```overpass
[out:json];
area["boundary"="administrative"]["admin_level"="4"]["name"="Jawa Timur"]->.jatim;
rel(area.jatim)["boundary"="administrative"]["admin_level"="6"]["name"~"^(Kabupaten )?Jember$",i];
out tags center;
```

Lanjutkan hanya setelah hasil mengidentifikasi tepat satu relasi Kabupaten Jember. Jika tidak ada atau lebih dari satu, inspeksi penamaan/tag dan pilih ID relasi yang benar secara manual; jangan memperluas query tanpa pemeriksaan. Area Overpass dapat belum tersedia walaupun relasinya ada.

### Query kecamatan

```overpass
[out:json];
area["boundary"="administrative"]["admin_level"="4"]["name"="Jawa Timur"]->.jatim;
rel(area.jatim)["boundary"="administrative"]["admin_level"="6"]["name"~"^(Kabupaten )?Jember$",i]->.kab;
.kab map_to_area ->.jember;
rel(area.jember)["boundary"="administrative"]["admin_level"="8"];
out body geom;
```

### Query desa/kelurahan

```overpass
[out:json];
area["boundary"="administrative"]["admin_level"="4"]["name"="Jawa Timur"]->.jatim;
rel(area.jatim)["boundary"="administrative"]["admin_level"="6"]["name"~"^(Kabupaten )?Jember$",i]->.kab;
.kab map_to_area ->.jember;
rel(area.jember)["boundary"="administrative"]["admin_level"~"^(9|10)$"];
out body geom;
```

Level 8 merupakan kandidat kecamatan; hasil level 9/10 perlu diklasifikasikan berdasarkan tag dan register lokal. Jangan menggabungkan dua level bertingkat menjadi daftar desa tanpa pengecekan duplikasi dan fungsi administratif. Query area merupakan seleksi spasial, bukan bukti hubungan induk administratif yang sah. Hasil dapat mencakup relasi yang menyentuh/melintasi batas dan harus dibandingkan dengan register serta geometri kabupaten.

Jika hasil sedikit atau kosong, jalankan diagnostik berikut, bukan membuat poligon perkiraan:

```overpass
[out:json];
area["boundary"="administrative"]["admin_level"="4"]["name"="Jawa Timur"]->.jatim;
rel(area.jatim)["boundary"="administrative"]["admin_level"="6"]["name"~"^(Kabupaten )?Jember$",i]->.kab;
.kab map_to_area ->.jember;
rel(area.jember)["boundary"="administrative"];
out tags center;
```

### Ekspor GeoJSON

`[out:json]` menghasilkan JSON Overpass, BUKAN GeoJSON. Setelah query geometri selesai di Overpass Turbo, gunakan Export → GeoJSON. GeoJSON menggunakan koordinat longitude, latitude dalam WGS84; jangan tertukar dengan latitude, longitude. Simpan ekspor mentah terpisah dari berkas yang dinormalisasi.

Periksa hasil konversi: relasi rusak dapat menjadi garis atau GeometryCollection, bukan Polygon/MultiPolygon. Jangan mengganti garis dengan convex hull untuk mengklaim batas administrasi. Seeder menolak geometri nonpoligon, kosong, tidak valid, atau di luar rentang koordinat dunia. Nilai dalam rentang dunia tetap belum membuktikan CRS atau lokasi Jember benar.

## 3. Kontrak data sebelum impor

Buat direktori `apps/api/storage/app/gis/jember/` dan sediakan:

- `districts.geojson`
- `villages.geojson`

Keduanya harus FeatureCollection tidak kosong. Setiap fitur harus memiliki properti berikut:

| Properti | Ketentuan |
|---|---|
| `code` | String kode BPS yang sudah diverifikasi; bukan ID OSM |
| `code_system` | String `BPS` |
| `regency_bps_code` | String `3509` |
| `name` | Nama wilayah sesuai register yang dipakai |
| `source` | Identitas sumber/versi yang stabil dan dapat ditelusuri |
| `source_feature_id` | Opsional, string ID fitur sumber, misalnya `relation/123`; jangan dipakai sebagai kode BPS |
| `district_code` | Khusus desa: kode BPS induk yang harus ada di berkas kecamatan |
| `centroid` | Opsional saat geometry null: array `[longitude, latitude]` dari sumber terpercaya |
| `fallback_radius_m` | Opsional khusus desa: radius terdokumentasi, lebih dari 0 sampai 10000 meter |

Ekspor OSM tidak otomatis memenuhi kontrak ini. Siapkan crosswalk sumber → BPS → induk terlebih dahulu. Jangan mencocokkan hanya berdasarkan nama; nama dapat berulang. Jangan menciptakan kode contoh lalu mengimpornya sebagai kode resmi.

Untuk poligon tersedia, centroid dihitung dengan ST_Centroid. Centroid dapat terletak di luar poligon cekung atau kepulauan; bukan titik bukti keanggotaan. Untuk geometry null, centroid dan radius harus disediakan dari rujukan tepercaya jika fallback ingin diaktifkan. Jangan mengarang radius dari jumlah desa. Radius dapat ditentukan melalui kajian jarak ke batas/luas atau survei, dengan dokumentasi kebijakan; metode lingkaran tetap tidak mewakili bentuk batas sebenarnya.

Seeder meng-upsert berdasarkan kode, menolak perubahan identitas sumber pada kode yang sama, dan tidak menghapus wilayah yang tidak ada di input. Jangan gunakan dataset parsial untuk menggantikan dataset produksi tanpa review; impor ulang dari sumber sama tetap dapat memperbarui geometri. Periksa diff dataset dan cadangkan database sebelum setiap impor.

## 4. Menjalankan secara eksplisit

SQL dan seeder belum dijalankan. Pastikan database tujuan benar, ada backup, dan tabel districts/villages belum memiliki skema berbeda. SQL sengaja tidak memakai CREATE TABLE IF NOT EXISTS agar ketidakcocokan tidak disembunyikan. File SQL ini adalah alternatif pemasangan manual, bukan migration Laravel otomatis.

PostgreSQL harus memiliki PostGIS; CREATE EXTENSION mungkin memerlukan administrator. Konfigurasikan koneksi pgsql Laravel pada lingkungan Anda tanpa membagikan kredensial. Jangan memakai SQLite/MySQL untuk skrip ini.

Dari root workspace, contoh perintah pemasangan setelah review dan persetujuan operator:

```sh
psql -X --set ON_ERROR_STOP=1 --dbname=<database_tujuan> --file=apps/api/database/jember_gis.sql
cd apps/api
php artisan db:seed --class=JemberBoundarySeeder
```

`<database_tujuan>` merupakan placeholder, bukan nilai siap pakai. Jika konfigurasi Laravel di-cache, perbarui cache konfigurasi sesuai prosedur deployment. Seeder tidak didaftarkan otomatis pada DatabaseSeeder dan tidak boleh dijalankan sebelum file GeoJSON serta crosswalk direview.

Kolom geometri: `geometry(MultiPolygon,4326)`. Tersedia indeks GiST pada geom kedua tabel dan centroid desa. Indeks centroid geometri tidak otomatis mempercepat ST_DistanceSphere; fungsi ini mengambil satu desa lewat kode unik terlebih dahulu sehingga tidak melakukan pencarian radius seluruh desa.

## 5. Validasi laporan

Fungsi SQL `validate_village_report` mengembalikan accepted, method, distance_m, tolerance_m, reason.

```sql
-- Ganti kode dengan kode desa yang benar dari hasil impor.
SELECT * FROM validate_village_report(
    'KODE_DESA_TERVERIFIKASI',
    113.70,  -- longitude contoh, bukan koordinat desa terverifikasi
    -8.17,   -- latitude contoh
    20,      -- estimasi akurasi perangkat dalam meter
    3000     -- batas maksimum toleransi kebijakan dalam meter
);
```

Aturan utama:

```sql
ST_Contains(village.geom, ST_SetSRID(ST_Point(lon, lat), 4326))
```

ST_Contains tidak memasukkan titik tepat pada batas. Fungsi mengembalikan alasan review batas apabila ST_Covers benar tetapi ST_Contains salah. Apabila kebijakan memerlukan batas inklusif, ubah kebijakan secara eksplisit; titik batas bersama tetap dapat dimiliki dua kandidat sehingga tidak boleh langsung dialokasikan tanpa aturan tambahan.

Fallback hanya jika geom NULL/kosong:

```sql
ST_DistanceSphere(
    village.centroid,
    ST_SetSRID(ST_Point(lon, lat), 4326)
)
```

Toleransi dinamis yang diimplementasikan:

```text
tolerance_m = min(max_tolerance_m, fallback_radius_m + accuracy_m)
```

accuracy_m harus 0–1000; max_tolerance_m harus lebih dari 0 sampai 10000. Nilai default cap 3000 adalah contoh kebijakan aplikasi, bukan standar nasional atau ukuran desa Jember. Sesuaikan melalui kajian lapangan. Tanpa radius/centroid terpercaya, fungsi menolak fallback. Poligon valid tetapi titik di luar tidak boleh diloloskan dengan jarak centroid. Poligon tidak valid juga tidak boleh ditutupi fallback.

ST_DistanceSphere menghasilkan jarak pendekatan dalam meter. ST_Distance pada geometry EPSG:4326 menghasilkan satuan derajat, sehingga bukan pengganti langsung. ST_SetSRID hanya menetapkan label CRS; data dari CRS lain harus ditransformasikan dengan CRS asal yang benar sebelum impor.

Hasil accepted=true dengan method=centroid_proximity hanya berarti kedekatan sementara, bukan bukti berada dalam desa. Aplikasi sebaiknya memisahkan status provisional/manual-review dari valid_polygon; jangan menganggap keduanya memiliki kekuatan bukti sama. Koordinat/akurasi perangkat juga bukan jaminan integritas anti-spoofing.

## 6. Checklist pengujian sebelum produksi

- Jalankan php -l pada seeder dan uji SQL pada database nonproduksi.
- Rekonsiliasi jumlah target 31/248 dengan register resmi bertanggal; laporkan wilayah hilang, berlebih, dan perbedaan status.
- Verifikasi semua kode dan parent melalui crosswalk bertanggal.
- Periksa SRID, ST_IsValid, tipe MultiPolygon, bbox Jember, gap, overlap, dan cakupan wilayah induk; validitas geometri saja tidak memeriksa semuanya.
- Uji titik di dalam, di luar, di batas, serta longitude/latitude terbalik.
- Uji geom null dengan/tanpa centroid dan radius; uji NaN, infinity, serta parameter NULL.
- Uji impor duplikat, parent hilang, poligon rusak, dan rollback transaksi.
- Uji impor ulang; pastikan tidak mengubah source tanpa review dan tidak menghapus data lama.
- Simpan metadata lisensi, versi dataset, dan checksum bersama catatan deployment.

Contoh audit awal setelah impor:

```sql
SELECT count(*) AS districts FROM districts WHERE regency_bps_code = '3509';
SELECT count(*) AS villages FROM villages v JOIN districts d ON d.id = v.district_id
WHERE d.regency_bps_code = '3509';
SELECT code, ST_IsValidReason(geom) FROM villages
WHERE geom IS NOT NULL AND NOT ST_IsValid(geom);
SELECT v.code FROM villages v JOIN districts d ON d.id = v.district_id
WHERE v.geom IS NOT NULL AND d.geom IS NOT NULL
  AND NOT ST_CoveredBy(v.geom, d.geom);
```

Perbedaan cakupan bisa berasal dari perbedaan versi/sumber maupun kesalahan topologi; jangan langsung memotong poligon tanpa review.
