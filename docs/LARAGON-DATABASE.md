# LARAGON 3 — Database MySQL 8.0.30

> **Diperbarui:** 2026-11-02 · **Sumber:** `my.ini`, enumerasi folder datadir `C:\laragon\data\mysql-8\`, `.env.local` proyek lama
> **Catatan:** Database tidak dapat diquery langsung saat analisa (service mati). Inventaris di bawah diambil dari folder datadir — setiap folder = satu database.

---

## 1. Konfigurasi Server

| Atribut | Nilai |
|---|---|
| Versi | **MySQL 8.0.30** (winx64) |
| Port | **3306** |
| Datadir | `C:\laragon\data\mysql-8` (diatur `my.ini`) |
| `max_allowed_packet` | **512M** (untuk impor dump besar) |
| Binlog | **Aktif** — file `binlog.000368` … `binlog.000375` (ruang disk tumbuh; pertimbangkan `expire_logs_days`/`binlog_expire_logs_seconds`) |
| TLS internal | Aktif (file `ca.pem`, `server-cert.pem`, `client-cert.pem` di datadir) |
| Client GUI | HeidiSQL (`bin\heidisql`), phpMyAdmin (`http://localhost/phpmyadmin`), Adminer (`http://localhost/adminer`) |

**Kredensial default Laragon** (dikonfirmasi dari `.env.local` sistem lama `jagapadi-3509`):

```
DB_HOST=127.0.0.1   DB_PORT=3306   DB_USER=root   DB_PASS=(kosong)
```

> Mesin dev lokal memang tanpa password. **Jangan pernah** memakai konfigurasi ini di server publik, dan jangan menulis kredensial proyek lain di dokumen ini.

**Upgrade menunggu:** `C:\laragon\tmp\mysql-8.0.46.zip` + `tmp\mysql-fresh\` sudah diunduh (persiapan upgrade 8.0.30 → 8.0.46) tetapi **belum dipasang**. Prosedur aman ada di [LARAGON-OPERATIONS.md](LARAGON-OPERATIONS.md).

---

## 2. Inventaris Database (45 database user)

Dikelompokkan per ekosistem aplikasi (nama folder di datadir):

### 2.1 JAGAPADI (sistem lama) — fokus utama

| Database | Keterangan | Bukti/ukuran |
|---|---|---|
| `jagapadi` | Database utama sistem lama (instalasi lokal) | — |
| `jagapadi_local` | Database lokal aktif yang ditunjuk `.env.local` proyek lama; **sumber impor referensi v3 (terverifikasi live 2026-11-02)** | **67 tabel** (koreksi dari estimasi awal 78) |
| `jagapadi_seed` | Data seed / template | — |
| `bpsjembe_jagapadi` | Database default yang disebut `TECH_STACK.md` proyek lama | **54 tabel, ±29 MB** |

> Untuk **impor data referensi ke JAGAPADI v3** (master wilayah, master OPT, KSA bulanan, harga — sesuai `BLUEPRINT.md` §6), sumber database yang relevan adalah `jagapadi_local` (78 tabel, termasuk tabel backup/sampah yang nanti diabaikan) dan `bpsjembe_jagapadi`. Verifikasi isinya setelah service dinyalakan: `SHOW TABLES;` pada masing-masing.

### 2.2 SE2026 / Wilkerstat

| Database | Keterangan |
|---|---|
| `bps_jember_se2026` | Wilkerstat SE2026 utama |
| `bps_jember_se2026_hosting` | Versi hosting |
| `bps_jember_se2026_test` | Versi uji |
| `se2026_jember` | Pendukung SE2026 |
| `se2026_peta` | Data peta SE2026 (terkait proyek QGIS Jember) |

### 2.3 Simitra / Monika / Monalisa

`bps_mitra`, `bpsjembe_3509_simitra`, `bpsjembe_simitra`, `simitra_db`, `simitra_test`, `monika`, `monalisa`, `monalisa_db`

### 2.4 Simpentra / SIMTP

`bpsjembe_newsimpentra`, `bpsjembe_simpentra`, `simtp_db`, `bpsjembe_simtp`

### 2.5 Lainnya (proyek BPS Jember & pribadi)

| Database | Terkait aplikasi |
|---|---|
| `ksa_padi_db`, `bpsjembe_ksapadi3509` | KSA-Padi (sub-aplikasi `ksa-padi` di 00-default.conf) |
| `sigap`, `sigap_3509`, `sigap_testing` | SIGAP (alias `/sigap` di Apache) |
| `monika` | MONIKA |
| `simapan_db`, `simonda` | Simapan / Simonda |
| `sijempol`, `sifeno`, `pelita` | aplikasi lain BPS Jember |
| `pandalungan`, `ubinan_pandalungan` | Pandalungan / ubinan |
| `linkar_jember` | — |
| `imk2025_monitor`, `j_insight`, `perpusdigital_db` | — |
| `bpsjembe_bt_kp`, `bpsjembe_ibstriwulanan`, `bpsjembe_jemberbis`, `bpsjembe_local`, `bpsjembe_navmenu` | — |
| `sipandhalu`, `sipandhalu_test` | SIPANDHALU |

*(Database sistem: `mysql`, `performance_schema`, `sys`, `phpmyadmin` tidak dicantumkan.)*

**Enumerasi ulang bila service sudah jalan:**

```bash
"C:/laragon/bin/mysql/mysql-8.0.30-winx64/bin/mysql" -u root -e "SHOW DATABASES;"
```

---

## 3. Backup & Restore (Panduan Cepat)

### Backup satu database

```bash
"C:/laragon/bin/mysql/mysql-8.0.30-winx64/bin/mysqldump" -u root \
  --single-transaction --routines --triggers \
  jagapadi_local > "D:/backup/jagapadi_local_$(date +%Y%m%d).sql"
```

### Backup SEMUA database sekaligus (wajib sebelum upgrade MySQL)

```bash
"C:/laragon/bin/mysql/mysql-8.0.30-winx64/bin/mysqldump" -u root \
  --single-transaction --all-databases --routines --triggers \
  > "D:/backup/all_databases_$(date +%Y%m%d).sql"
```

### Restore

```bash
"C:/laragon/bin/mysql/mysql-8.0.30-winx64/bin/mysql" -u root \
  -e "CREATE DATABASE IF NOT EXISTS jagapadi_local CHARACTER SET utf8mb4"
"C:/laragon/bin/mysql/mysql-8.0.30-winx64/bin/mysql" -u root jagapadi_local < dump.sql
```

Aturan praktis:
- Simpan dump **di luar** `C:\laragon` (mis. `D:\backup`), karena `www.zip` tidak mencakup datadir.
- Matikan service MySQL **dengan benar** (Stop di Laragon) — jangan bunuh proses; InnoDB bisa rusak.
- Binlog memungkinkan point-in-time recovery, tapi jangan diandalkan sebagai satu-satunya backup.

---

## 4. Gap: Target JAGAPADI v3 Memakai PostgreSQL 16 + PostGIS

Blueprint v3 menetapkan **PostgreSQL 16 + PostGIS** — dan Laragon ini **tidak memiliki PostgreSQL** (`laragon.ini` `[postgresql] Use=-1`, tidak ada bin). MySQL **tetap dipakai** untuk sistem lama; keduanya bisa hidup berdampingan (port berbeda: 3306 vs 5432).

| Opsi | Penjelasan | Rekomendasi |
|---|---|---|
| **A. Docker Desktop + `docker-compose`** | Sesuai blueprint (PostGIS image resmi + Redis 7 + Mailpit dalam satu compose). Butuh install Docker Desktop | ⭐ **Direkomendasikan** — reproducible, mudah dibersihkan |
| B. PostgreSQL native/zip Windows | Install PostgreSQL 16 + Stack Builder (PostGIS) di Windows | Berfungsi, tapi lebih sulit di-repro dan bercampur dengan sistem |
| C. Pakai MySQL | ❌ Tidak sesuai blueprint (butuh PostGIS `ST_Contains`, index GIST) | Tidak disarankan |

Prasyarat & poin perhatian opsi A: virtualisasi aktif di BIOS, `docker -v` harus dikenali, dan **port 5432/6379 tidak bentrok** dengan Redis/Memcached bawaan Laragon bila service tersebut ikut dinyalakan. Rincian langkah Fase 0 di [LARAGON-OPERATIONS.md](LARAGON-OPERATIONS.md) § Gap Analysis.

---

## Riwayat Perubahan

| Tanggal | Perubahan |
|---|---|
| 2026-11-02 | Dokumen dibuat — inventaris 45 DB dari datadir; catatan upgrade 8.0.46 belum terpasang; gap PostgreSQL diidentifikasi |
| 2026-11-02 | **Verifikasi live** (MySQL dinyalakan): inventaris 45 DB cocok; `jagapadi_local` aktual **67 tabel** (bukan 78) dan merupakan sumber impor v3 — satu-satunya DB dengan `data_ksa_bulanan` (3.952 baris, 2018–2026), wilayah 31 kec/248 desa, OPT 51, iklim 2020–2026-08, harga 2022–2026-08; `bpsjembe_jagapadi` (54 tabel) tidak punya tabel KSA; `jagapadi` kosong; laporan transaksi lokal: hama 9 + irigasi 7 |
