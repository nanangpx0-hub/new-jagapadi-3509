# LARAGON 4 — Inventaris Proyek di `C:\laragon\www`

> **Diperbarui:** 2026-11-02 · **Sumber:** listing folder + deteksi marker (`composer.json`, `package.json`, `index.php`, `backend/composer.json`)
> Dokumen root: `C:/laragon/www` — diakses via `http://localhost/<folder>` atau `http://<folder>.test`

---

## 1. Proyek Aktif / Penting

### 1.1 `jagapadi-3509` — Sistem Lama (referensi utama)

| Atribut | Nilai |
|---|---|
| Jenis | Monorepo PHP — **custom MVC ringan (bukan Laravel)** + Backend v1 + API endpoint |
| Marker | `composer.json` (phpspreadsheet, phpunit), `package.json` (Vite 5.4, Chart.js 4), `index.php`, `backend/` (MVC skeleton PHP 8.2, phpstan, phpunit 239 test) |
| Database | `jagapadi_local` (78 tabel, via `.env.local`), `bpsjembe_jagapadi` (54 tabel), `jagapadi`, `jagapadi_seed` |
| Status | v1.1.3+6 — Staging Verified (2026-09-01); Flutter mobile aktif (22k+ baris, FCM, offline DB) |
| URL | `http://jagapadi.test` (vhost manual), `http://jagapadi-3509.test` (auto vhost) |
| Peran terhadap v3 | **Referensi untuk impor data referensi** (master wilayah, OPT, KSA, harga) — bukan di-refactor, per `BLUEPRINT.md` |
| Dokumentasi | `docs/README.md` di dalam folder proyek (katalog per peran) |

### 1.2 `new-jagapadi-3509` — Proyek Ini (JAGAPADI v3)

| Atribut | Nilai |
|---|---|
| Jenis | Monorepo baru: Laravel 11 (PHP 8.3) + React 19 PWA + PostgreSQL/PostGIS + Redis (via Docker) |
| Isi saat ini | **Hanya `docs/`** — BLUEPRINT.md, ROADMAP.md, dan set dokumentasi lingkungan ini. Kode belum di-scaffold (Fase 0 belum dieksekusi) |
| Rencana URL | Disarankan `http://jagapadi-v3.test` (auto vhost dari nama folder) — folder saat ini bernama `new-jagapadi-3509`, jadi auto-vhost-nya `http://new-jagapadi-3509.test` |

### 1.3 `petalink`

Aplikasi berbasis Node/NPM (`package.json`, tidak ada composer). Vhost manual: `http://petalink.test`.

### 1.4 `sipandhalu`

Aplikasi PHP berbasis Composer. Vhost manual: `http://sipandhalu.test`; DB `sipandhalu`, `sipandhalu_test`.

### 1.5 `data-strategis-jember`

Dashboard "JagaJember" (struktur `config`, `dashboard`, `reports`, `src`, `surat`, `docs`; ada `Dokumentasi_JagaJember_Dashboard.docx`). Arsip `data-strategis-jember.zip` (±686 MiB) juga berada di www — pertimbangkan pindahkan ke luar webroot.

---

## 2. Proyek Non-Web / Utilitas / Dokumen

| Folder | Isi | Catatan |
|---|---|---|
| `bps-3509-server-hub` | Utilitas **C#** (`Server.exe`, `ServerHub.cs`, `build.bat`, `manage-server.ps1`) + `PANDUAN_DAN_PROMPT_REPLIKASI_PC_LAIN.md` | Bukan web app; server hub internal untuk replikasi PC BPS |
| `majapahit` | Proyek survei BPS: `sakernas`, `seruti`, `susenas` + dokumen AI (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) | Kumpulan dokumen/prompt, bukan runtime web |
| `snapgent` | Tool AI berbasis **Python** (`bridge.exe`, `config.json`, `DAFTAR_PENYEDIA_AI.md`) | Bukan web app; arsip `snapgent v1.zip` (±37 MiB) |
| `temp` | PHP misc (`index.php`) | Folder kerja sementara |

## 3. Arsip di Webroot

| File | Ukuran | Catatan |
|---|---|---|
| `www.zip` (di `C:\laragon\`) | ±1,24 GiB (Jan 2026) | Backup seluruh www — jangan ditaruh di webroot publik tanpa perlu |
| `data-strategis-jember.zip` | ±686 MiB (Okt 2026) | Arsip proyek |
| `snapgent v1.zip` | ±37 MiB (Okt 2026) | Arsip proyek |

> **Saran housekeeping:** pindahkan semua `*.zip` dari `C:\laragon\www` ke `D:\backup` atau sejenisnya. File besar di webroot bisa terunduh publik saat akses LAN aktif (`Require all granted`), dan memperlambat listing index.

---

## 4. Virtual Host Terkait — Status

Dari 38 file di `sites-enabled\`, yang **valid dan berfungsi**:

| Vhost | Jenis | Folder target | Ada? |
|---|---|---|---|
| `00-default.conf` | manual | `C:/laragon/www` | ✅ |
| `jagapadi.test.conf` | manual | `www\jagapadi-3509` | ✅ |
| `petalink.test.conf` | manual | `www\petalink` | ✅ |
| `auto.jagapadi-3509.test.conf` | auto | `www\jagapadi-3509` | ✅ |
| `auto.sipandhalu.test.conf` | auto | `www\sipandhalu` | ✅ |
| `auto.new-jagapadi-3509.test.conf` | auto | `www\new-jagapadi-3509` | dibuat otomatis saat Apache reload berikutnya |
| `auto.data-strategis-jember.test.conf` | auto | `www\data-strategis-jember` | ✅ |

**Usang (folder target tidak ada lagi) — aman dihapus:**

```
auto.jagapadi-3509-1.test.conf   auto.jagapadi-3509-3.test.conf
auto.jagapadi-3509-8.test.conf   auto.jagapadi-3509-9.test.conf
auto.jagapadi-3509-10.test.conf  auto.jagapadi-3509.worktrees.test.conf
auto.jagapadi-ori.test.conf
auto.se2026-jember-backup.test.conf   auto.se2026-jember-backup2.test.conf
auto.se2026-jember-test.test.conf     auto.se2026-jember.worktrees.test.conf
auto.---dashboard-se2026.test.conf    (nama tidak lazim)
auto.dashboard-se2026.test.conf, auto.evaluasi.test.conf, auto.fasih.test.conf,
auto.gabung*.test.conf, auto.maestro_jember.test.conf, auto.nametag.test.conf,
auto.pekppp.test.conf, auto.pelita.bpsjember.my.id.test.conf, auto.sadap.test.conf,
auto.scraping.test.conf, auto.script-fasih-main.test.conf, auto.se2026-jember.test.conf,
auto.sejati.test.conf, auto.simapan.test.conf, auto.simitra*.test.conf,
auto.SiMitra-BPS-main.test.conf, auto.KAK.test.conf, auto.temp.test.conf, ...
```

> Cara verifikasi cepat: bandingkan daftar folder di `www` dengan `ServerName`/`DocumentRoot` tiap `auto.*.conf`. Laragon juga umumnya meregenerasi `auto.*` sesuai folder aktual saat reload — file usang yang tertinggal bisa dihapus manual. (Sesuaikan daftar saat membersihkan; jangan hapus vhost yang masih ditunjuk host file.)

---

## Riwayat Perubahan

| Tanggal | Perubahan |
|---|---|
| 2026-11-02 | Dokumen dibuat — inventaris 9 folder proyek + 3 arsip; identifikasi vhost usang |
