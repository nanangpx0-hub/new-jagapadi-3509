# Runbook penghentian JAGAPADI lama dan migrasi referensi

## Status: template, bukan migrasi yang sudah dijalankan

Workspace hanya memperlihatkan stack target PostgreSQL/PostGIS; dump dan skema 67 tabel lama belum tersedia. Nama tabel, kolom, kode komoditas, relasi, serta satuan legacy TIDAK diasumsikan. Semua token __...__ dan <...> wajib diganti setelah discovery. Belum ada konfigurasi Laragon aktif, user MySQL, database, atau volume Docker yang diubah.

Berkas pendamping:

- laragon-readonly.conf.example: fragmen Nginx atau Apache untuk virtual host legacy.
- mysql-discovery-and-extract.sql: query discovery dan template SELECT terarah.
- postgres-reference-schema.sql: usulan staging, reject log, dan tabel referensi target.

Stack target yang ditemukan pada docker-compose.yml: service postgres, container jagapadi_v3_postgres, image postgis/postgis:16-3.4-alpine, volume data persisten. Gunakan nilai database/user dari konfigurasi deployment yang sebenarnya, bukan menganggap default pasti dipakai. Jangan menjalankan docker compose down -v atau menghapus volume.

## 1. Bekukan sistem lama dengan pertahanan berlapis

1. Inventaris seluruh domain, HTTPS/HTTP vhost, port backend, scheduler, Windows Task Scheduler, queue worker, import terjadwal, webhook, dan integrasi yang menulis database.
2. Cadangkan konfigurasi Laragon, aplikasi, dump penuh, dan file unggahan. Simpan checksum SHA-256, waktu pengambilan, versi MySQL dan storage engine. Batasi akses karena dump penuh dapat mengandung data pribadi.
3. Pasang fragmen deny-method hanya pada vhost lama. Konfigurasi mengizinkan GET/HEAD dan menolak semua metode lain, termasuk POST/PUT/PATCH/DELETE, dengan 403. Jangan menerapkannya pada vhost/API v3.
4. Hentikan produsen write non-HTTP dan drain request/job yang sedang berjalan. Audit GET yang menulis data; filter HTTP tidak dapat mengamankan route GET dengan side effect.
5. Alihkan kredensial aplikasi arsip ke akun MySQL khusus SELECT dan restart/recycle proses/koneksi lama. Kredensial write sebelumnya harus dicabut aksesnya untuk aplikasi; jangan hanya menambahkan user baru lalu membiarkan kredensial lama tetap digunakan.
6. Buat final snapshot konsisten dan simpan manifest cutover. Periksa transaksi aktif serta DDL yang mungkin masih berjalan.
7. Uji arsip menggunakan kredensial SELECT; sesuaikan session/cache ke penyimpanan terpisah bila perlu. Jangan memberi write ke seluruh database hanya agar halaman login/cache tetap berjalan.

Contoh SQL administratif, belum dieksekusi:

```sql
-- Jalankan pada MySQL lama oleh admin, bukan pada PostgreSQL.
-- Ganti database, host koneksi sebenarnya, dan password kuat unik.
CREATE USER 'jagapadi_archive'@'localhost' IDENTIFIED BY '<PASSWORD_KUAT_UNIK>';
GRANT SELECT ON `<LEGACY_DB>`.* TO 'jagapadi_archive'@'localhost';
SHOW GRANTS FOR 'jagapadi_archive'@'localhost';
```

Audit views/routines dan SQL SECURITY DEFINER: SELECT pada view yang memanggil fungsi tidak otomatis menjamin bebas side effect. Jangan grant EXECUTE/FILE/SUPER. Untuk arsip sensitif, batasi SELECT lebih rinci ke tabel/view yang disetujui. Jika perlu read_only/super_read_only tingkat server, lakukan hanya pada instance legacy dedicated setelah penilaian dampak: setting global memengaruhi seluruh database Laragon dan tidak menggantikan kontrol privileges. Jangan menyalakannya secara buta di instance bersama.

Untuk arsip paling stabil, pertimbangkan hasil render statis yang sudah diperiksa dan diakses terbatas, tanpa PHP/backend write-capable. Pastikan arsip tidak membuka data pribadi tanpa autentikasi.

### Pengujian HTTP

Gunakan curl.exe agar tidak tertukar alias PowerShell. Ganti URL dan pilih GET route yang telah diaudit tidak menulis.

```powershell
curl.exe -i https://<LEGACY_HOST>/
curl.exe -I https://<LEGACY_HOST>/
curl.exe -i -X POST https://<LEGACY_HOST>/
curl.exe -i -X PUT https://<LEGACY_HOST>/
curl.exe -i -X PATCH https://<LEGACY_HOST>/
curl.exe -i -X DELETE https://<LEGACY_HOST>/
```

GET/HEAD diharapkan tetap tersedia sesuai autentikasi arsip; semua metode mutasi harus 403, bukan redirect ke halaman lain. Uji ulang semua alias dan port langsung. Periksa log serta checksum/count database untuk memastikan route GET tidak mengubah referensi.

## 2. Dari dump lama ke data referensi terarah

### Restore ke clone terisolasi terlebih dahulu

Dump SQL tidak boleh disaring menggunakan findstr/grep nama tabel: extended INSERT dapat panjang, referensi dapat terlewat, dan definisi charset/DELIMITER bisa terpotong. Jangan memasukkan dump MySQL ke psql.

Pulihkan dump ke MySQL clone yang kompatibel dan disposable, tanpa jaringan produksi. Dump dapat memuat CREATE DATABASE/USE, trigger, routine, event, atau SQL berbahaya; periksa sebelum restore. Biarkan event_scheduler OFF dan jangan menjalankan aplikasi/worker terhadap clone. `mysql --database=...` tidak melindungi dari USE di dalam dump. Jangan menjalankan restore menggunakan admin instance Laragon yang juga menampung database produksi lain.

Untuk input redirection di Windows, jalankan contoh berikut di CMD, bukan menganggap operator < bekerja sama di semua versi PowerShell:

```bat
mysql --login-path=legacy_clone --default-character-set=utf8mb4 --database=<CLONE_DB> < C:\secure\legacy-full.sql
```

Gunakan file binary asli dari dump; jangan membukanya lalu Save As melalui editor yang mengganti encoding. Jika dump menyatakan latin1 atau charset lain, telaah header/session charset dan lakukan percobaan restore yang diverifikasi; opsi utf8mb4 bukan perintah memperbaiki byte rusak secara ajaib.

### Discovery dan profil data

Jalankan query aktif pada mysql-discovery-and-extract.sql dengan database clone terpilih. Verifikasi primary key, foreign key, crop dictionary, tanggal/periode, satuan, dan grain observasi. TABLE_ROWS pada information_schema dapat bersifat estimasi; gunakan COUNT(*) aktual untuk rekonsiliasi.

Untuk setiap kandidat, catat COUNT(*), MIN/MAX tanggal, jumlah NULL, jumlah zero-date, rentang desimal, kode tak dikenal, dan duplikasi PK/business key. Inventaris tabel kamus minimum yang diperlukan; tidak perlu memindahkan seluruh 67 tabel.

### Mysqldump terarah

Simpan kredensial memakai mysql_config_editor/login-path atau option file dengan ACL terbatas. Jangan menulis password pada command line/repository. Nama executable harus merujuk versi client yang disetujui; flag client MySQL 8 tidak otomatis tersedia pada client 5.7.

Contoh berikut satu baris per perintah. Ganti token berdasarkan hasil discovery:

```bat
mysqldump --login-path=legacy_clone --default-character-set=utf8mb4 --single-transaction --quick --skip-triggers --set-gtid-purged=OFF --no-create-info --complete-insert --skip-extended-insert --hex-blob --where="__PERIOD_DATE__ >= '2018-01-01' AND __PERIOD_DATE__ < '2027-01-01' AND __CROP_CODE__ IN (__PADDY_CODE__,__MAIZE_CODE__)" --result-file="C:\secure\ksa-2018-2026.mysql.sql" <CLONE_DB> <KSA_TABLE>
mysqldump --login-path=legacy_clone --default-character-set=utf8mb4 --single-transaction --quick --skip-triggers --set-gtid-purged=OFF --no-create-info --complete-insert --skip-extended-insert --hex-blob --result-file="C:\secure\reference-selected.mysql.sql" <CLONE_DB> <OPT_TABLE> <OPT_CROP_LINK_TABLE> <CLIMATE_TABLE> <PRICE_TABLE> <REQUIRED_DICTIONARY_TABLES>
```

--where berlaku untuk seluruh tabel pada invocation tersebut: jangan mencampur tabel berkolom tanggal berbeda dalam satu command terfilter. Untuk KSA yang memakai year/month terpisah, ganti predikat dengan tahun 2018 sampai 2026 dan bulan 1 sampai 12 yang tervalidasi. Nilai kode string harus diberi single quote SQL di dalam predicate. Jika flag --column-statistics diperlukan pada client 8, periksa `mysqldump --help` lebih dulu; jangan menambahkannya pada client yang tidak mendukung.

File tersebut masih SQL MySQL, bukan format PostgreSQL. --no-create-info membatasi DDL tabel; tetap review header/session statements. --single-transaction memberi snapshot konsisten untuk tabel transaksional seperti InnoDB, bukan MyISAM. Hindari DDL bersamaan; clone yang dibekukan lebih aman untuk tabel campuran dan beberapa invocation dump. Jika muncul error privileges/tablespaces, tinjau versi dan opsi client secara spesifik; jangan memberi privilege global luas hanya untuk melewati error.

Data historis iklim/harga tidak otomatis dibatasi 2018–2026: rentang tahun tersebut diminta khusus KSA. Data sampai Desember 2026 mungkin belum tersedia; jangan mengisi bulan yang belum ada dengan nol atau nilai perkiraan.

### Ekspor hasil SELECT untuk ETL

Template SELECT pada file SQL mengekstrak kolom relevan. Gunakan adapter DB/ETL yang menulis CSV RFC-compatible dengan quoting atau JSON Lines UTF-8 secara eksplisit. Jangan mengubah keluaran mysql --batch menjadi CSV dengan mengganti tab memakai koma: gejala OPT dapat mengandung tab, koma, kutip, dan newline. Jangan memakai --raw jika escaping diperlukan. SELECT INTO OUTFILE menulis pada filesystem SERVER dan membutuhkan privilege/secure_file_priv; jangan mengasumsikan path client Windows adalah path server.

Simpan nilai raw dan stable source_id. Untuk hasil unpivot satu baris menjadi banyak metrik, gunakan source_id asli + discriminator yang deterministik. Jangan gunakan nomor urut hasil query sebagai ID permanen. Jika scope hanya Jember, gunakan filter kode wilayah melalui crosswalk yang diverifikasi; jangan menganggap kode legacy sama dengan BPS 3509.

## 3. Mapping ke PostgreSQL 16

### Usulan model referensi

| Keluarga | Target | Grain dan aturan |
|---|---|---|
| KSA | reference.ksa_observations | Observasi sumber per bulan/komoditas/segmen/subsegmen/metrik; jangan dijumlahkan tanpa definisi statistik |
| OPT | reference.opt_master | Nama umum, nama latin, gejala, serta lineage sumber |
| Tanaman sasaran OPT | reference.opt_target_crops | Relasi banyak-ke-banyak dengan reference.crops |
| Iklim | reference.climate_observations | Satu metrik per observasi, mempertahankan stasiun, tanggal/timestamp, unit dan quality flag |
| Harga | reference.commodity_prices | Tanggal, komoditas, pasar, grade, mata uang, nilai dan unit |
| Audit | legacy_stage.import_batches/raw_records/rejects | Sumber, hash dump, versi mapping, raw JSON dan alasan penolakan |

Kode padi/jagung target adalah kode kanonik migrasi, bukan klaim kode BPS atau legacy. Tambahkan tanaman lain yang sah untuk master OPT; hanya KSA yang dibatasi dua komoditas. Jika KSA menyimpan kategori fase tumbuh, gunakan metric_code dan metadata yang jelas; jangan mengubah kode kategori menjadi luas/produksi numerik.

### Tipe data dan normalisasi

| MySQL/sumber | PostgreSQL | Kebijakan |
|---|---|---|
| ID BIGINT UNSIGNED | text source_id; bigint identity target | Tidak memaksa ID unsigned ke signed bigint; nilai sumber bisa melebihi rentang |
| Kode wilayah/komoditas | text | Pertahankan leading zero; simpan code system dan versi crosswalk |
| DECIMAL(p,s) | numeric(p,s), usulan numeric(24,8) | Profil rentang/skala dahulu; hindari float untuk harga |
| FLOAT/DOUBLE historis | numeric hanya setelah kajian | Konversi tidak mengembalikan presisi yang sudah hilang |
| DATE | date | Validasi kalender ketat; jangan mengarang timezone |
| DATETIME | timestamp atau timestamptz setelah lokalisasi | DATETIME tidak menyimpan timezone; sumber harus diketahui |
| TIMESTAMP | timestamptz | Ekspor session UTC bila semantik sumber sesuai; catat timezone |
| ENUM/SET | text/kamus/relasi | Gunakan mapping eksplisit, jangan menyalin angka ordinal internal |
| TINYINT(1) | boolean hanya bila benar-benar boolean | Nilai selain 0/1 harus direview; display width bukan bukti boolean |
| TEXT/VARCHAR | text UTF-8 | Decode ketat, buang NUL hanya dengan audit, validasi panjang dan konten |

numeric(24,8) di file SQL adalah usulan, bukan hasil profiling. PostgreSQL dapat membulatkan skala saat cast; periksa jumlah digit pecahan sebelum cast dan log perubahan presisi. Jangan memetakan NaN/Infinity sebagai pengukuran sah.

### Sanitasi UTF-8

1. Identifikasi charset deklaratif per tabel/kolom dan bandingkan dengan byte sampel. Charset header, encoding aktual, serta mojibake adalah masalah berbeda.
2. Decode memakai encoding sumber yang terbukti dengan mode strict. Jangan melakukan UTF-8 decode dengan errors=ignore/replace karena merusak nama latin/gejala tanpa jejak.
3. Jika decode gagal, karantina record dan simpan raw bytes/checksum di arsip aman; JSON PostgreSQL bukan tempat untuk byte invalid.
4. PostgreSQL text tidak menerima U+0000. Hapus/ganti hanya berdasarkan kebijakan terdokumentasi dan log source_id + field + tindakan. Raw dump tetap dipertahankan.
5. Normalisasi Unicode NFC bila dibutuhkan untuk pencarian/konsistensi, tanpa mengubah penulisan nama latin secara sembarang. Jangan memakai normalisasi agresif untuk ID/kode.
6. Mojibake seperti hasil double-encoding tidak boleh diperbaiki dengan replace global. Terapkan aturan teruji pada subset yang terbukti, simpan sebelum/sesudah dan persetujuan reviewer.
7. Perbedaan collation MySQL case/accent-insensitive dengan PostgreSQL dapat mengubah perilaku unik/pencarian; profil konflik sebelum menambah unique constraint berbasis nama. Gunakan identitas sumber untuk deduplikasi.

### Tanggal dan desimal

- Nilai 0000-00-00, komponen tanggal nol, atau tanggal mustahil bukan tanggal PostgreSQL yang sah. Jadikan NULL hanya jika semantik missing disetujui dan kolom mengizinkan; selain itu masukkan reject log. Jangan mengganti dengan 1970-01-01.
- Parse format tanggal secara eksplisit. Untuk DD/MM/YYYY, lakukan parse ketat beserta round-trip; jangan mengandalkan DateStyle, parser browser, atau to_date tanpa validasi.
- Periode bulanan dinormalisasi ke tanggal pertama bulan setelah tahun dan bulan valid; jangan mengubah observasi harian menjadi rerata bulanan tanpa aturan agregasi.
- Contoh lokalisasi DATETIME yang TERBUKTI WIB: timestamp '2020-06-01 07:00:00' AT TIME ZONE 'Asia/Jakarta'. Untuk sumber yang sudah UTC, jangan lokalisasi ulang sebagai WIB. Data iklim dari sumber lain bisa memakai zona berbeda.
- Ambil DECIMAL native sebagai string bertitik. Teks Indonesia 1.234,56 menjadi 1234.56 hanya setelah format kolom dikonfirmasi. Nilai 1,234 ambigu; jangan menebak apakah 1.234 atau 1234.
- Validasi string numerik kanonik dengan regex, rentang, dan skala sebelum cast. Tanda minus tidak otomatis salah untuk suhu; harga negatif perlu ditolak/review. Nol curah hujan atau harga bukan otomatis NULL.
- Pertahankan satuan; Rp/kg tidak sama dengan Rp/kuintal. Konversi unit harus memiliki faktor dan rekam jejak eksplisit. Jangan menganggap semua harga menggunakan IDR jika data tidak menyatakannya.

## 4. Memuat ke container target secara terkendali

Jalankan pada database staging/nonproduksi terlebih dahulu. File SQL tidak ditempatkan di folder init Docker: skrip init biasanya hanya berjalan pada volume data baru, bukan setiap restart.

Contoh operator setelah mengganti placeholder, mengambil backup, dan menyetujui DDL:

```powershell
docker compose ps postgres
docker compose cp docs/legacy-migration/postgres-reference-schema.sql postgres:/tmp/postgres-reference-schema.sql
docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U <PG_USER> -d <PG_DATABASE> -f /tmp/postgres-reference-schema.sql
```

Periksa target dengan SELECT current_database(), current_user, version(); serta SHOW server_encoding; sebelum DDL. Gunakan role migrasi terbatas, bukan otomatis memakai role superuser aplikasi. Skrip memakai CREATE SCHEMA/TABLE tanpa IF NOT EXISTS agar konflik skema tidak disembunyikan; jangan jalankan ulang tanpa rencana migrasi.

ETL harus mendaftarkan UUID batch, checksum dump, dan versi mapping, memuat raw_records, lalu memisahkan accepted/reject sebelum INSERT tabel referensi. File ini belum menyediakan ETL adapter karena skema sumber tidak tersedia. Gunakan parameter binding atau CSV terkutip dengan COPY, jangan menyusun SQL dari teks gejala.

COPY FROM path membaca filesystem container/server. psql \copy membaca filesystem tempat psql berjalan; jika psql dijalankan dengan docker compose exec, path tersebut juga path di container. Salin CSV ke container terlebih dahulu atau gunakan STDIN melalui pipeline byte-preserving yang sudah diuji. Jangan mengandalkan pipeline teks Windows PowerShell 5.1 untuk mempertahankan encoding file secara identik.

Impor per batch dalam transaksi dengan ON_ERROR_STOP. Jangan menambahkan ON CONFLICT DO NOTHING untuk menyembunyikan konflik. Untuk rerun, bandingkan checksum/hash payload dan gunakan strategi upsert yang disetujui berdasarkan source_system/source_id/metric_code. Simpan perubahan revisi sumber; jangan menduplikasi seri hanya karena batch berbeda.

## 5. Rekonsiliasi, go/no-go dan rollback

- Untuk setiap keluarga: extracted = accepted + rejected dengan aturan grain yang sama; bila unpivot, catat multiplier/metrik dan missing metric secara eksplisit.
- Bandingkan jumlah per tahun/bulan/komoditas untuk KSA; per station/metric untuk iklim; per commodity/market/grade/unit untuk harga.
- Bandingkan NULL, min/max, jumlah referensi induk hilang, dan distribusi unit; checksum raw dump tidak menggantikan validasi isi target.
- Jangan menjumlahkan harga untuk membuktikan kebenaran seri; gunakan count dan perbandingan row-level. Untuk KSA, hanya agregasikan metrik yang memang aditif.
- Audit duplikasi nama OPT dan relasi tanaman sasaran tanpa membuang sinonim otomatis.
- Uji pembacaan aplikasi v3, hak akses SELECT untuk referensi yang sudah dipublikasikan, dan backup/restore target.
- Persetujuan pemilik data diperlukan sebelum cutover final. Bila gagal, rollback batch/transaksi target atau restore snapshot target; jangan membuka kembali write sistem lama secara otomatis.
- Simpan arsip lama read-only, manifest migrasi dan checksum. Penghapusan sistem lama/data pribadi memerlukan jadwal retensi dan persetujuan tersendiri.

## Yang masih diperlukan untuk query final

Diperlukan hasil discovery/DDL tabel kandidat, dictionary komoditas dan satuan, contoh baris yang telah disamarkan, format periode, serta definisi grain KSA. Tanpa itu, nama tabel dan query join final tidak dapat dibuat secara bertanggung jawab. Jangan mengirim dump penuh dengan kredensial/data pribadi ke percakapan.
