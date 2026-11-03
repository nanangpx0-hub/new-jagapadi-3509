# LARAGON 2 — Struktur Direktori & Konfigurasi

> **Diperbarui:** 2026-11-02 · **Sumber:** pembacaan langsung seluruh file konfigurasi yang disebut

---

## 1. Struktur Direktori `C:\laragon`

```text
C:\laragon\
├── laragon.exe                  # Eksekusi utama (v6.0.0.2)
├── acli.exe                     # CLI asisten Laragon/AI CLI
├── LAN-ACCESS-GUIDE.md          # Panduan akses LAN (dibuat saat setup LAN, Apr 2026)
├── setup-lan-access.bat         # Script firewall rule port 80
├── www.zip                      # Arsip cadangan seluruh www (±1,24 GiB, Jan 2026)
├── bin\                         # Semua binary runtime
│   ├── apache\httpd-2.4.54-win64-VS16\
│   ├── php\                     # 5 versi: 8.1.10(TS), 8.2.30, 8.3.29, 8.4.16, 8.5.1
│   ├── mysql\mysql-8.0.30-winx64\
│   ├── nodejs\node-v18\
│   ├── composer\  git\  nginx\  ngrok\  redis\  memcached\  mongodb\
│   ├── heidisql\  phpmyadmin\  python\  code\  notepad++\
│   ├── cmder\  cronical\  sendmail\  telnet\  yarn\  laragon\
├── data\
│   └── mysql-8\                 # Datadir MySQL (binlog aktif, ±45 database)
├── etc\                         # Konfigurasi yang di-include Apache
│   ├── apache2\
│   │   ├── alias\               # adminer, laragon(dashboard), memcached, phpmyadmin, redis, sigap
│   │   ├── sites-enabled\       # 38 file .conf virtual host
│   │   ├── lan-access.conf      # Akses dari LAN (Require all granted)
│   │   ├── mod_php.conf         # Pemilih PHP untuk Apache (→ 8.1.10 TS)
│   │   ├── httpd-ssl.conf       # SSL, Listen 443
│   │   └── fcgid.conf
│   ├── php\pear\                # konfigurasi PEAR
│   ├── ssl\cacert.pem           # CA bundle
│   └── apps\  cmder\  nginx\
├── keystore\
│   └── app-release-key.jks      # Keystore sign APK Android (warisan Flutter)
├── tmp\
│   ├── php_errors.log           # Log error PHP terakhir: 13-Sep-2026 (log akses dashboard jagapadi)
│   ├── mail-*.txt               # Keluaran sendmail (mailcatcher)
│   ├── hosts.tmp                # Draft hosts yang ditulis Laragon saat start
│   ├── mysql-8.0.46.zip         # ⚠️ unduhan upgrade MySQL — BELUM TERPASANG
│   ├── mysql-fresh\             # datadir bersih cadangan
│   └── ci_session*, downloads\, extract\
├── usr\
│   └── laragon.ini              # Preferensi utama Laragon
└── www\                         # DOCUMENT ROOT — semua proyek web (lihat LARAGON-WWW-INVENTORY.md)
```

---

## 2. Preferensi Utama — `usr\laragon.ini`

```ini
[preferences]
RunAtStartup=-1          ; jalankan Laragon saat Windows start
AutoVirtualHosts=-1      ; otomatis buat vhost <namafolder>.test + entry hosts
RightClickMenu=-1        ; integrasi klik kanan Explorer
Lang=English
DataDir=C:\laragon\data
AutoCheck=0              ; nonaktifkan cek update otomatis

[php]     Version=php-8.2.30-nts-Win32-vs16-x64   ; PHP CLI default
[apache]  Version=httpd-2.4.54-win64-VS16 ; Use=-1 ; DocumentRoot=C:/laragon/www
[mysql]   Version=mysql-8.0.30-winx64 ; Use=-1
[nodejs]  Version=node-v18
[nginx]   Version=nginx-1.22.0 ; Upstream=2
[redis]   Version=redis-x64-5.0.14.1
[memcached] Version=memcached-1.6.8-win64-mingw
[python]  Version=python-3.10
[mongodb] Version=mongodb-win32-x64-ssl-3.4.2 ; Use=-1
[postgresql] Use=-1                        ; PostgreSQL tidak terpasang
[mailcatcher] LastMailFile=mail-20260609-060032.770.txt
```

**Cara mengganti versi PHP CLI default:** klik kanan tray Laragon → PHP → Version → pilih 8.3. Laragon akan menulis ulang entri `[php] Version=` di atas. Ingat: ini **tidak** mengubah mod_php Apache (§3.1).

---

## 3. Apache

### 3.1 Rantai konfigurasi

`bin\apache\httpd-2.4.54-win64-VS16\conf\httpd.conf` (disetel Laragon) berisi antara lain:

```apache
Listen 80
ServerName Laragon
Include conf/extra/httpd-vhosts.conf
IncludeOptional "C:/laragon/etc/apache2/alias/*.conf"        # phpMyAdmin, Adminer, dll.
IncludeOptional "C:/laragon/etc/apache2/sites-enabled/*.conf" # virtual hosts proyek
Include "C:/laragon/etc/apache2/httpd-ssl.conf"              # Listen 443 (SSL)
Include "C:/laragon/etc/apache2/fcgid.conf"
Include "C:/laragon/etc/apache2/lan-access.conf"             # akses LAN (custom)
```

`etc\apache2\mod_php.conf` (auto-generated Laragon):

```apache
LoadModule php_module "C:/laragon/bin/php/php-8.1.10-Win32-vs16-x64/php8apache2_4.dll"
PHPIniDir "C:/laragon/bin/php/php-8.1.10-Win32-vs16-x64"
<IfModule mime_module>
    AddType application/x-httpd-php .php
</IfModule>
```

> **Fakta penting (terverifikasi 2026-11-02):** meskipun `mod_php.conf` memuat modul PHP, file `etc\apache2\fcgid.conf` yang di-include dari httpd.conf **meng-override** penanganan `.php`:
>
> ```apache
> LoadModule fcgid_module "C:/laragon/etc/apache2/modules/mod_fcgid-2.3.10-win64-VS16.so"
> <IfModule fcgid_module>
>   FcgidInitialEnv PHPRC "C:/laragon/bin/php/php-8.3.36-Win32-vs16-x64"
>   FcgidWrapper "C:/laragon/bin/php/php-8.3.36-Win32-vs16-x64/php-cgi.exe" .php
>   <Files ~ "\.php$"> AddHandler fcgid-script .php </Files>
> </IfModule>
> ```
>
> **Mengganti versi PHP web = edit 3 file** (agar semua jalur konsisten):
> 1. `etc\apache2\fcgid.conf` — 3 path di dalamnya: `FcgidInitialEnv PATH`, `FcgidInitialEnv PHPRC`, `FcgidWrapper`
> 2. `etc\apache2\mod_php.conf` — `LoadModule` + `PHPIniDir` (harus versi Thread Safe)
> 3. `usr\laragon.ini` — `[php] Version=` (CLI default)
>
> lalu reload Apache. Backup sebelum switch 2026-11-02: `fcgid.conf.bak-php8.2-20261102`, `mod_php.conf.bak-php8.1-20261102`, `laragon.ini.bak-20261102`.
>
> ⚠️ Jangan tunjukkan `mod_php.conf` ke versi NTS — mod_php hanya jalan dengan PHP Thread Safe.

### 3.2 Virtual host default — `sites-enabled\00-default.conf`

Melayani semua request yang tidak cocok ServerName lain:

```apache
<VirtualHost _default_:80>
    DocumentRoot "C:/laragon/www"
    ServerName localhost
    <Directory "C:/laragon/www">
        AllowOverride All
        Require all granted
        Options Indexes FollowSymLinks
    </Directory>
    # Kustomisasi manual (tambahan lokal):
    <Directory "C:/laragon/www/ksa-padi"> ... DirectoryIndex index.php ... </Directory>
    <Location "/ksa-padi/"> Require all granted </Location>
    Alias /sigap "C:/laragon/www/sigap"
    <Directory "C:/laragon/www/sigap"> ... </Directory>
</VirtualHost>
```

Artinya: `http://localhost/nama-folder` juga berfungsi (browsing www + sub-aplikasi `ksa-padi`, `sigap`).

### 3.3 Pola virtual host proyek

**Dua jenis file di `sites-enabled\` (38 file total):**

1. **Manual** (dibuat sendiri): `jagapadi.test.conf`, `petalink.test.conf` — contoh:

   ```apache
   <VirtualHost *:80>
       DocumentRoot "C:/laragon/www/jagapadi-3509"
       ServerName jagapadi.test
       ServerAlias www.jagapadi.test
       <Directory "C:/laragon/www/jagapadi-3509">
           Options Indexes FollowSymLinks
           AllowOverride All
           Require all granted
       </Directory>
   </VirtualHost>
   ```

2. **Auto** (dibuat Laragon, prefiks `auto.`): `auto.jagapadi-3509.test.conf`, `auto.sipandhalu.test.conf`, dll. — dibuat otomatis untuk setiap folder di `www` saat AutoVirtualHosts aktif, dengan pola `ServerName <namafolder>.test` + `ServerAlias *.<namafolder>.test`.

**⚠️ Konf usang (housekeeping):** 10 file `auto.*.conf` menunjuk folder yang **sudah tidak ada** di `www`:

```
auto.jagapadi-3509-1 / -3 / -8 / -9 / -10 / worktrees.test.conf
auto.jagapadi-ori.test.conf
auto.dashboard-se2026.test.conf  (dua varian: dengan dan tanpa "auto.---dashboard-se2026")
auto.se2026-jember* / sejati / simapan / dsb. — cek keberadaan folder sebelum menghapus
```

File-file ini tidak berbahaya, tetapi sebaiknya dihapus/dibersihkan agar daftar rapi. Laragon biasanya membuat ulang `auto.*` sesuai folder aktual saat Apache di-reload.

### 3.4 Daftar URL lokal aktif

| URL | Mengarah ke |
|---|---|
| `http://localhost` | Index `C:\laragon\www` (dashboard Laragon di `/laragon` alias) |
| `http://jagapadi.test` / `http://jagapadi-3509.test` | `www\jagapadi-3509` (sistem lama) |
| `http://petalink.test` | `www\petalink` |
| `http://sipandhalu.test` | `www\sipandhalu` |
| `http://localhost/phpmyadmin` | phpMyAdmin (via alias) |
| `http://localhost/adminer` | Adminer (via alias) |
| `http://localhost/sigap` | Aplikasi SIGAP (alias manual) |
| `<namafolder>.test` | pola auto-vhost untuk folder lain di `www` |

**hosts file** (`C:\Windows\System32\drivers\etc\hosts`) saat ini hanya memuat 3 entri `.test` (`petalink.test`, `jagapadi.test`, `sipandhalu.test`) + `localhost`. Entri `.test` lain **ditambahkan otomatis oleh Laragon** setiap Apache start (draft ditulis ke `tmp\hosts.tmp`). Bila domain `.test` tidak resolve, cek hosts dan lakukan `ipconfig /flushdns`.

### 3.5 SSL

- `etc\apache2\httpd-ssl.conf` → `Listen 443` siap.
- Sertifikat/CA di `etc\ssl\cacert.pem`.
- Aktivasi per-vhost: Menu Laragon → Apache → SSL → Enabled (Laragon menambahkan blok `:443` pada vhost terkait).
- Untuk proyek baru `new-jagapadi-3509`, SSL lokal sebaiknya diaktifkan agar mirip produksi (HTTPS), terutama untuk PWA/service worker yang menuntut secure context.

---

## 4. Akses LAN (Konfigurasi Sudah Terpasang)

Dua file kunci (dibuat April 2026, dokumentasi asli: `C:\laragon\LAN-ACCESS-GUIDE.md`):

**1. `etc\apache2\lan-access.conf`** — di-include dari httpd.conf:

```apache
<Directory "C:/laragon/www">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted     # ← semua IP boleh akses
</Directory>
```

Komentar di dalamnya sudah menyiapkan pembatasan per subnet (192.168.x / 10.x / 172.16-31.x) — tinggal di-uncomment bila ingin membatasi.

**2. Firewall Windows** — rule `Apache HTTP Server`, allow TCP 80 (dibuat oleh `setup-lan-access.bat`):

```bat
netsh advfirewall firewall add rule name="Apache HTTP Server" dir=in action=allow protocol=TCP localport=80
```

**IP address mesin ini (per Apr 2026, bisa berubah jika DHCP):**

| Antarmuka | IP |
|---|---|
| Wi-Fi | `192.168.17.44` |
| Ethernet | `10.200.13.16` |

Akses dari perangkat lain satu jaringan:

```
http://192.168.17.44/               → index www
http://192.168.17.44/jagapadi-3509/ → sistem lama via IP
```

> **Catatan keamanan:** `Require all granted` berarti **siapa pun** di jaringan (termasuk Wi-Fi publik bila mesin tersambung) dapat membuka semua proyek. Larangan/risiko lebih detail dibahas di [LARAGON-OPERATIONS.md](LARAGON-OPERATIONS.md) § Keamanan.

---

## Riwayat Perubahan

| Tanggal | Perubahan |
|---|---|
| 2026-11-02 | Dokumen dibuat — snapshot konfigurasi awal |
| 2026-11-02 | **Revisi:** ditambah penjelasan override `fcgid.conf` atas `mod_php.conf`, aturan edit 3 file saat ganti versi PHP, dan lokasi file backup switch ke 8.3.36 |
