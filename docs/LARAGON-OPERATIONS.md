# LARAGON 5 — Operasional, Troubleshooting & Gap Analysis Fase 0

> **Diperbarui:** 2026-11-02 · Dokumen induk: [README.md](README.md)

---

## 1. Operasional Harian

### 1.1 Menjalankan & Menghentikan

| Aksi | Cara |
|---|---|
| Nyalakan semua service | Buka `C:\laragon\laragon.exe` → klik **Start All** (Apache + MySQL) |
| Hanya Apache | Menu → Apache → Start / Reload |
| Hanya MySQL | Menu → MySQL → Start |
| Matikan semua | Tombol **Stop All** |
| Reload konfigurasi tanpa restart | Menu → Apache → Reload (wajib setelah edit vhost/lan-access) |

Laragon juga terset `RunAtStartup` (jalan saat Windows menyala) — service tetap harus di-Start manual kecuali diatur Menu → Preferences → General → Start All.

### 1.2 Health Check Cepat (Git Bash / cmd)

```bash
# Service hidup?
tasklist | grep -iE "httpd|mysqld"           # proses Apache & MySQL
netstat -ano | grep LISTENING | grep -E ":(80|3306) "   # port 80 & 3306

# Web jalan?
curl -I http://localhost                     # harus HTTP/1.1 200 (index / dashboard Laragon)
curl -I http://jagapadi.test                 # harus 200/302 (sistem lama)

# Database jalan?
"C:/laragon/bin/mysql/mysql-8.0.30-winx64/bin/mysql" -u root -e "SELECT VERSION();"
```

Di Windows PowerShell, `grep` diganti `findstr`. Bila port 80 tidak listening tapi httpd jalan, kemungkinan bentrok port (§2.2).

### 1.3 Log Penting

| Log | Lokasi |
|---|---|
| Error PHP (semua request Apache) | `C:\laragon\tmp\php_errors.log` |
| Log Apache (access/error) | `C:\laragon\bin\apache\httpd-2.4.54-win64-VS16\logs\` |
| Error MySQL | `C:\laragon\data\mysql-8\*.err` (hostname.err) |
| Keluaran mail developer | `C:\laragon\tmp\mail-*.txt` (via sendmail — tidak ada email sungguhan yang terkirim) |

---

## 2. Troubleshooting Umum

### 2.1 Domain `.test` tidak terbuka ("site can't be reached" / DNS)

1. Cek `C:\Windows\System32\drivers\etc\hosts` memuat `127.0.0.1 <nama>.test` (Laragon menulisnya saat Apache start; draft di `tmp\hosts.tmp`).
2. `ipconfig /flushdns` lalu coba lagi.
3. Vhost file ada di `etc\apache2\sites-enabled\`? Reload Apache.

### 2.2 Port 80 bentrok (Apache gagal start)

Penyebab umum: IIS / World Wide Web Publishing Service, Skype, aplikasi lain memakai 80.

```bat
netstat -ano | find ":80"            ; lihat PID pemilik
tasklist | findstr <PID>
net stop http                        ; jika IIS/W3SVC (HATI-HATI: menghentikan layanan Windows)
```

Alternatif: ganti port Apache ke 8080 (Menu → Preferences → General → Apache Port) — tapi semua URL harus pakai `:8080`.

### 2.3 MySQL tidak start

1. Cek log `.err` di datadir `C:\laragon\data\mysql-8\`.
2. Bentrok port 3306 dengan MySQL/MariaDB lain → cek `netstat -ano | find ":3306"`.
3. Datadir rusak → ada persiapan datadir bersih di `tmp\mysql-fresh\` (jalankan ulang `mysql_install_db`-ekuivalen Laragon atau Menu → MySQL → datadir kosong baru), **setelah** dump semua DB penting.

### 2.4 Mengganti / mengecek versi PHP web vs CLI

- Sejak 2026-11-02 semua jalur seragam **PHP 8.3.36** (web via FCGI php-cgi, mod_php, CLI).
- Yang melayani `.php` di Apache adalah **mod_fcgid → `php-cgi.exe`** (`etc\apache2\fcgid.conf`); `AddHandler fcgid-script` menimpa `AddType` mod_php. Detail & aturan edit 3 file: [LARAGON-CONFIGURATION.md](LARAGON-CONFIGURATION.md) §3.1.
- **Verifikasi versi web jangan percaya file conf saja** — buat file sementara `<?php echo PHP_VERSION;` di webroot, buka via `http://localhost/<file>.php`, hapus setelah selesai (itulah cara menemukan override ini).
- Jejak penting: `extension=zip` **wajib eksplisit** mulai PHP 8.2+ (di 8.1 zip dibundel statis ke php.exe). Tanpa itu `ZipArchive` hilang → ekspor XLSX jagapadi gagal (terbukti & sudah diperbaiki di php.ini 8.3.36).
- `httpd -k start` dari terminal biasa akan **gagal** ("Failed to open the 'Apache2.4' service — Access is denied") karena itu mode service Windows. Untuk uji manual: jalankan `httpd.exe` polos; untuk harian: Start All via Laragon.

### 2.5 Akses LAN tidak bisa (dari HP/PC lain)

Ikuti `C:\laragon\LAN-ACCESS-GUIDE.md`: pastikan Apache Reload, firewall rule `Apache HTTP Server` ada (`netsh advfirewall firewall show rule name="Apache HTTP Server"`), device satu subnet, dan IP masih sama (DHCP bisa mengubahnya — gunakan IP statis/DHCP reservation untuk `192.168.17.44` / `10.200.13.16`).

### 2.6 Error `max_allowed_packet` / import gagal

`my.ini` sudah di-set 512M. Untuk dump sangat besar, impor via CLI (bukan phpMyAdmin yang dibatasi upload PHP 2G):

```bash
"C:/laragon/bin/mysql/mysql-8.0.30-winx64/bin/mysql" -u root nama_db < dump.sql
```

---

## 3. Keamanan Lingkungan Dev

| Risiko di mesin ini | Kondisi saat ini | Rekomendasi |
|---|---|---|
| MySQL root tanpa password | Ya (default Laragon) | Wajar untuk dev lokal; pastikan MySQL **hanya** listen 127.0.0.1 (default) dan tidak dipakai di server |
| Akses LAN terbuka semua IP | `Require all granted` untuk seluruh `C:/laragon/www` | Batasi: uncomment pembatasan subnet di `etc\apache2\lan-access.conf` (192.168. / 10.) lalu Reload Apache. Jangan aktifkan saat tersambung Wi-Fi publik |
| Arsip besar + `.zip` di webroot | `www.zip` ±1,24 GiB di `C:\laragon\` (di luar www ✅), 2 zip di dalam www ⚠️ | Pindahkan zip dari `www` ke luar; bisa terunduh publik via LAN/IP |
| `.env` berisi kredensial di proyek lama | `.env.local` ada di `jagapadi-3509` | Jangan pernah commit; jangan diekspos via alias/URL |
| Kredensial di dokumen | — | Dokumentasi ini sengaja **tidak** memuat password apapun |
| ngrok / tunnel | tersedia | Gunakan hanya seperlunya; tunnel mengekspos dev server ke internet |

---

## 4. GAP ANALYSIS — Persiapan Fase 0 JAGAPADI v3

Blueprint v3 (`docs/BLUEPRINT.md`) + Roadmap Fase 0 menargetkan: Laravel 11 (PHP 8.3) + React 19 PWA + **PostgreSQL 16 + PostGIS** + **Redis 7** + Mailpit, semuanya via `docker-compose`. Kondisi Laragon saat ini:

| Kebutuhan Fase 0 | Kondisi Terpasang | Gap / Aksi |
|---|---|---|
| Docker Desktop | ✅ Selesai: Desktop 4.97.0.244584; Engine 29.9.2; Compose v5.6.1 | Backend WSL2 berjalan; tidak memerlukan restart untuk verifikasi ini |
| PostgreSQL 16 + PostGIS | ✅ Selesai: PostgreSQL 16.4 + PostGIS 3.4.3 | Container healthy; localhost:5432; seluruh ekstensi init terverifikasi |
| Redis 7 | ✅ Selesai: Redis 7.4.12; PONG | localhost:16379 menuju container:6379; port 6379 termasuk exclusion Windows 6309-6408; Redis Laragon tidak dihentikan |
| PHP 8.3 | ✅ **Terpasang 8.3.36 (2026-11-02)** — FCGI web + mod_php + CLI seragam; ekstensi lengkap termasuk `zip`; tuning 2G/512M diwarisi dari php.ini 8.1 | **Selesai.** Host siap untuk tooling CLI; runtime v3 tetap di container Docker |
| PHP untuk sistem lama | ✅ Kini **8.3.36** (sebelumnya FCGI 8.2.30 NTS). Regresi backend suite: **267 tests / 784 assertions / 0 error**; smoke test HTTP `jagapadi.test` → 200 | Root suite belum bisa dijalankan karena `vendor/` root memang tidak terpasang (kondisi pre-existing, bukan akibat switch) — jalankan `composer install` di root bila ingin baseline 277 test |
| Node.js | ✅ Selesai: v24.11.0; npm 11.6.2 (aktif di PATH) | Portable node-v22 & node-v18 dipertahankan di Laragon |
| Composer | ✅ Selesai: 2.8.12 (sesuai target 2.8.x) | Terverifikasi langsung di PATH; backup 2.4.1 tersedia |
| Mailpit | ✅ Selesai: container healthy; UI HTTP 200 | UI localhost:8025; SMTP localhost:1025 |
| Port | PostgreSQL 5432; Redis 16379; Mailpit 8025/1025, seluruhnya loopback | Port 80/3306 dan exclusion Windows tidak diubah |
| Database referensi impor | ✅ `jagapadi_local` (78 tabel), `bpsjembe_jagapadi` (54 tabel) tersedia | Setelah v3 jalan, buat script impor seeder dari dump MySQL ini sesuai BLUEPRINT §6 |

### Urutan aksi disarankan (mengunci risiko paling awal)

1. Selesai: Docker Desktop, daemon WSL2, dan Compose terverifikasi.
2. Selesai dengan deviasi: Composer 2.11.1 (latest 2.x sesuai izin Tugas 1), bukan 2.8.x.
3. ~~Aktifkan PHP 8.3 CLI~~ — **SELESAI 2026-11-02**: PHP 8.3.36 terpasang dan menjadi default semua jalur (web FCGI, mod_php, CLI) dengan ekstensi lengkap.
4. Eksekusi scaffold Fase 0 sesuai `ROADMAP.md` (monorepo `apps/api`, `apps/web`, `packages/shared`, `docker/`).
5. Tambahkan konvensi lokal: vhost baru `http://new-jagapadi-3509.test` otomatis tersedia bila folder ini tetap di `www` (auto virtual hosts), namun karena stack berbasis Docker+Nginx sendiri, alur kerja utama akan `http://localhost:<port-compose>` — jadikan `*.test` hanya untuk proyek PHP lama.

> **Prinsip pemisahan:** biarkan Laragon (Apache+PHP 8.3.36+MySQL) melayani **sistem lama dan proyek PHP lain**, dan jalankan **v3 sepenuhnya di Docker**. Jangan mengubah konfigurasi Laragon yang sudah stabil demi v3.

### Pemeliharaan yang tertunda (dari analisa)

- [ ] Upgrade MySQL 8.0.30 → **8.0.46** (unduhan sudah ada di `tmp\mysql-8.0.46.zip`; backup semua DB dulu — §2.3 LARAGON-DATABASE).
- [ ] Bersihkan ~20 vhost `auto.*.conf` usang (folder tidak ada lagi — LARAGON-WWW-INVENTORY §4).
- [ ] Pindahkan `data-strategis-jember.zip` & `snapgent v1.zip` keluar dari webroot.
- [ ] Pertimbangkan limit `max_execution_time=36000` di PHP 8.1 (10 jam) hanya untuk kebutuhan scraper — turunkan untuk request biasa bila keamanan diinginkan.

---

## Riwayat Perubahan

| Tanggal | Perubahan |
|---|---|
| 2026-11-02 | Dokumen dibuat — SOP operasional, troubleshooting, keamanan, dan gap analysis Fase 0 |
| 2026-11-02 | **Revisi:** PHP 8.3.36 terpasang (gap ditutup); §2.4 ditulis ulang (arsitektur FCGI, `extension=zip`, `httpd -k start` vs console); hasil regresi backend suite dicatat |

| 2026-11-03 | Infrastruktur Fase 0 selesai dengan deviasi tercatat: Composer 2.11.1 dan Redis host 16379. Tiga container healthy, PostGIS aktif, Redis PONG, Mailpit HTTP 200. Bukti: PHASE0-INFRA-VERIFICATION.txt. Scaffold aplikasi/CI belum dikerjakan. Terminal/VS Code lama perlu dibuka ulang untuk mewarisi User PATH baru. |
