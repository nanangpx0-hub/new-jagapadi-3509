# LARAGON 1 — Ikhtisar Lingkungan Kerja

> **Diperbarui:** 2026-11-02 · **Sumber:** inspeksi langsung `C:\laragon`, `usr\laragon.ini`, metadata `laragon.exe`, daftar proses/ports
> **Status service saat analisa:** ⛔ **Semua service mati** (Apache & MySQL tidak berjalan — tidak ada `httpd.exe`/`mysqld.exe` di memori, port 80/3306 tidak `LISTENING`)

---

## 1. Identifikasi Instalasi

| Atribut | Nilai |
|---|---|
| Produk | Laragon **Full** edition |
| Versi | **6.0.0** (build file `6.0.0.2`, FileDescription: "Laragon") |
| Tanggal build installer | 16 Sep 2022 |
| Lokasi instalasi | `C:\laragon` |
| Dokumen root web | `C:\laragon\www` |
| Direktori data | `C:\laragon\data` (diatur `DataDir` di `laragon.ini`) |
| Eksekusi saat startup Windows | Aktif (`RunAtStartup=-1`) |
| Auto Virtual Hosts (`*.test`) | Aktif (`AutoVirtualHosts=-1`) |
| Integrasi klik kanan Explorer | Aktif (`RightClickMenu=-1`) |
| Bahasa UI | English |
| Auto-check update | **Nonaktif** (`AutoCheck=0`) |

Pengaturan di atas dibaca dari `C:\laragon\usr\laragon.ini` (lihat [LARAGON-CONFIGURATION.md](LARAGON-CONFIGURATION.md) untuk isi lengkap).

---

## 2. Komponen Runtime & Versi

### 2.1 Web Server & PHP

| Komponen | Versi | Peran | Catatan |
|---|---|---|---|
| **Apache** | 2.4.54 (win64-VS16) | Web server utama | Port **80**, SSL siap di port **443**; DocumentRoot `C:/laragon/www` |
| **PHP (Apache via mod_fcgid)** | **8.3.36 ZTS** (vs16-x64) | Runtime semua proyek PHP via Apache | ⚠️ Yang benar-benar melayani `.php` adalah **mod_fcgid → `php-cgi.exe`** (`etc\apache2\fcgid.conf`), bukan mod_php. Di-upgrade 2026-11-02 dari 8.2.30 NTS |
| **PHP (CLI default)** | **8.3.36** (vs16-x64) | Default `php` di terminal / `laragon.ini` | `php.ini` turunan 8.1.10 (tuning 2G/512M) + `extension=zip` eksplisit — di 8.1 zip dibundel statis, di 8.3 jadi shared |
| PHP 8.1.10 TS · 8.2.30 NTS · 8.3.29 NTS · 8.4.16 NTS · 8.5.1 NTS | tersedia | Cadangan / rollback | 8.1.10 = sumber referensi php.ini (EOL); 8.2.30 = runtime FCGI lama s.d. 2026-11-02; 8.3.29 NTS php.ini-nya polos — hindari |
| PHP 8.4.16 NTS | tersedia | Cadangan | — |
| PHP 8.5.1 NTS | tersedia | Cadangan | — |
| **Nginx** | 1.22.0 | Alternatif web server | Tidak digunakan sebagai server utama (Apache yang aktif) |

> **Arsitektur PHP–Apache (dikoreksi 2026-11-02 setelah smoke test HTTP):** request `.php` dilayani oleh **mod_fcgid → `php-cgi.exe`** yang ditunjuk `etc\apache2\fcgid.conf`. Direktif `FcgidWrapper` + `AddHandler fcgid-script` **meng-override** `AddType` dari `mod_php.conf` — mengganti versi PHP web = mengedit `fcgid.conf`, bukan sekadar `mod_php.conf`. (Analisa awal dokumen ini keliru mengira mod_php 8.1.10 yang aktif; koreksi ini didasarkan bukti `PHP_VERSION` via HTTP dan proses `php-cgi.exe` yang berjalan.) Sejak 2026-11-02 ketiga jalur — web FCGI, mod_php, CLI — seragam di **8.3.36**.

### 2.2 Tuning `php.ini` PHP 8.3.36 (runtime Apache & CLI — turunan dari 8.1.10)

| Direktif | Nilai | Arti |
|---|---|---|
| `max_execution_time` | **36000** (≈10 jam) | Diubah jauh dari default 30 detik — untuk proses panjang (scraper/impor besar) |
| `memory_limit` | **512M** | Batas memori per request PHP |
| `post_max_size` | **2G** | Batas total body POST |
| `upload_max_filesize` | **2G** | Batas ukuran unggahan per file |
| `extension_dir` | `C:/laragon/bin/php/php-8.3.36-Win32-vs16-x64/ext` | — |
| `extension=zip` | aktif (eksplisit) | Di 8.1.10 zip dibundel **statis**; mulai 8.2+ jadi shared — tanpa baris ini `ZipArchive` hilang dan ekspor XLSX jagapadi error |

Implikasi: perubahan unggahan besar (mis. Excel KSA ratusan MB) memungkinkan, tetapi jangan bawa tuning ekstrem ini ke produksi.

### 2.3 Database & Cache

| Komponen | Versi | Status konfigurasi |
|---|---|---|
| **MySQL** | **8.0.30** (winx64) | Aktif sebagai DB utama; port 3306; datadir `C:\laragon\data\mysql-8`; `max_allowed_packet=512M`; binlog aktif. Detail di [LARAGON-DATABASE.md](LARAGON-DATABASE.md) |
| **Redis Laragon (cadangan)** | 5.0.14.1 (x64) | Instalasi lama dipertahankan; tidak digunakan v3 |
| PostgreSQL + PostGIS | 16.4 + 3.4.3 | Docker `jagapadi_v3_postgres`, healthy; localhost:5432; postgis, postgis_topology, uuid-ossp aktif |
| Redis v3 | 7.4.12 | Docker `jagapadi_v3_redis`, healthy; localhost:16379 menuju container:6379; PONG terverifikasi |
| Mailpit v3 | axllent/mailpit:latest | Docker healthy; UI http://localhost:8025 = HTTP 200; SMTP localhost:1025 |
| **Memcached** | 1.6.8 (win64-mingw) | Bin tersedia; alias Apache `/memcached` |
| **MongoDB** | 3.4.2 (2017) | Terdaftar di `laragon.ini`, versi sangat tua, tidak dipakai proyek aktif |

### 2.4 Toolchain Pendukung

| Tool | Versi | Lokasi |
|---|---|---|
| Node.js | v24.11.0; npm 11.6.2 (aktif di PATH) | `bin\nodejs\node-v22` & `node-v18` tetap tersedia di Laragon |
| Composer | 2.8.12 (sesuai target 2.8.x) | `bin\composer`; backup `composer.phar.bak-2.4.1`; diagnose exit 0 |
| Git | **2.37.3.windows.1** | `bin\git` |
| Python | 3.10 | `bin\python` |
| HeidiSQL | (GUI SQL) | `bin\heidisql` |
| phpMyAdmin + Adminer | alias Apache | `bin\phpmyadmin`, akses `http://localhost/phpmyadmin`, `http://localhost/adminer` |
| ngrok | (tunnel) | `bin\ngrok` |
| Cmder | (terminal) | `bin\cmder` |
| Notepad++ | (editor) | `bin\notepad++` |
| VS Code | (editor) | `bin\code` |
| cronical, sendmail, telnet, yarn | utilitas | `bin\...` |
| Docker Desktop / Engine / Compose | 4.97.0.244584 / 29.9.2 / v5.6.1 | `C:\Program Files\Docker\Docker`; backend WSL2 aktif; tiga container healthy |

Aset khusus:
- `C:\laragon\keystore\app-release-key.jks` — keystore penandatanganan APK Android (warisan aplikasi mobile Flutter sistem lama).
- `C:\laragon\www.zip` (±1,24 GiB, Jan 2026) — **arsip cadangan seluruh folder www**.
- `C:\laragon\tmp\mysql-8.0.46.zip` + folder `tmp\mysql-fresh` — unduhan MySQL 8.0.46 siap upgrade, **belum terpasang** (bin masih 8.0.30).

---

## 3. Status Service Saat Analisa (2026-11-02 ±21:00 WIB)

| Service | Status | Bukti |
|---|---|---|
| Apache (httpd) | ⛔ Mati | `tasklist` tanpa `httpd.exe`; tidak ada listener port 80 |
| MySQL (mysqld) | ⛔ Mati | Tidak ada listener port 3306 |
| Redis / Memcached | ⛔ Mati | Tidak ada listener port 6379/11211 |
| Laragon (GUI) | ⛔ Tidak aktif di tray | Tidak ada proses `laragon.exe` |

> Dokumen ini menganalisis **konfigurasi tersimpan**, bukan kondisi berjalan. Semua data (versi, database, vhost) diambil dari file — sehingga tetap valid meski service mati. Untuk menyalakan ulang, buka `C:\laragon\laragon.exe` → **Start All**, atau lihat [LARAGON-OPERATIONS.md](LARAGON-OPERATIONS.md).

---

## 4. Path Cepat (Cheat Sheet)

| Kebutuhan | Path |
|---|---|
| Root semua proyek web | `C:\laragon\www` |
| Konfigurasi preferensi Laragon | `C:\laragon\usr\laragon.ini` |
| Konfigurasi Apache (override Laragon) | `C:\laragon\etc\apache2\` |
| Virtual hosts | `C:\laragon\etc\apache2\sites-enabled\*.conf` |
| Konfigurasi akses LAN | `C:\laragon\etc\apache2\lan-access.conf` |
| mod_php (runtime Apache) | `C:\laragon\etc\apache2\mod_php.conf` |
| php.ini per versi PHP | `C:\laragon\bin\php\<versi>\php.ini` |
| Konfigurasi MySQL | `C:\laragon\bin\mysql\mysql-8.0.30-winx64\my.ini` |
| Datadir MySQL | `C:\laragon\data\mysql-8\` |
| Log error PHP | `C:\laragon\tmp\php_errors.log` |
| Log Apache | `C:\laragon\bin\apache\httpd-2.4.54-win64-VS16\logs\` |
| Keluaran mail developer (sendmail) | `C:\laragon\tmp\` (`mail-*.txt`) |
| hosts file | `C:\Windows\System32\drivers\etc\hosts` |

---

## Riwayat Perubahan

| Tanggal | Perubahan |
|---|---|
| 2026-11-02 | Dokumen dibuat — snapshot analisa lingkungan awal (sebelum Fase 0) |
| 2026-11-02 | **Revisi:** PHP 8.3.36 dipasang & menjadi default semua jalur (FCGI/mod_php/CLI); koreksi arsitektur — web dilayani mod_fcgid→php-cgi, bukan mod_php; catatan `extension=zip` |

| 2026-11-03 | Prasyarat infrastruktur diverifikasi: Node 22.23.4, npm 10.9.9, Composer 2.11.1, Docker Desktop 4.97.0.244584; PostgreSQL 16.4/PostGIS 3.4.3, Redis 7.4.12, Mailpit healthy. Redis host 16379 karena Windows mengecualikan 6309-6408. PHP 8.3.36 dan konfigurasi Apache/MySQL tidak diubah. |
