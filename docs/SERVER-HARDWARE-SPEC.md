# JAGAPADI v3 — Spesifikasi Perangkat Keras & Kapasitas Server

> **Diperbarui:** 2026-11-03 (WIB)
> **Host / Server:** `DESKTOP-221G8EB` (Lenovo ThinkStation P-Series `30BGS0LK00`)
> **Pengguna / Unit:** `IPDS` (Local Account — BPS Kabupaten Jember)
> **Peran:** Server Pengembangan, Staging, & Host Kontainer JAGAPADI v3

---

## 1. Spesifikasi Perangkat Keras (Hardware Specifications)

| Komponen | Spesifikasi Aktual | Catatan Kapasitas |
|---|---|---|
| **Device Name** | `DESKTOP-221G8EB` (`30BGS0LK00`) | Workstation kelas enterprise / server 24/7 |
| **Processor (CPU)** | **Intel(R) Xeon(R) CPU E3-1220 v6 @ 3.00GHz** (3.00 GHz) | 4 Core fisik, arsitektur Kaby Lake Xeon, stabil untuk beban database spasial & worker antrean |
| **Installed RAM** | **32.0 GB** @ 2400 MHz | Sangat lega untuk menjalankan Docker WSL2 (PostgreSQL/PostGIS + Redis) berdampingan dengan Laragon & pengolahan GIS |
| **Storage** | **1.14 TB** (Terpakai ±805 GB, Tersisa **±335 GB**) | Mencukupi untuk penyimpanan database PostGIS dan foto lapangan terkompresi WebP (maks 1280px) |
| **Graphics Card (GPU)** | **NVIDIA Quadro P600 (2 GB)** | Mendukung akselerasi grafis desktop dan pengolahan peta/QGIS di mesin yang sama |
| **System Type** | 64-bit operating system, x64-based processor | Mendukung penuh virtualisasi Hyper-V & WSL2 |

---

## 2. Spesifikasi Sistem Operasi (Windows Specifications)

| Atribut | Nilai |
|---|---|
| **Edition** | Windows 11 Pro |
| **Version** | `25H2` |
| **Installed on** | 2026-05-27 |
| **OS Build** | `26200.6718` |
| **Experience** | Windows Feature Experience Pack `1000.26100.372.0` |

---

## 3. Alokasi Sumber Daya untuk JAGAPADI v3

Dengan total **RAM 32.0 GB** dan **CPU Xeon 4-Core**, pembagian beban kerja antara Host Windows (Laragon/QGIS) dan Docker Desktop (WSL2) direkomendasikan sebagai berikut:

| Layanan / Layer | Alokasi Memori Ideal | Catatan Operasional |
|---|---|---|
| **WSL2 / Docker Engine (`.wslconfig`)** | Maks **12 GB** (`processors=3`) | Mencegah `vmmemWSL` menghabiskan seluruh RAM host saat proses impor data besar |
| **PostgreSQL 16.4 + PostGIS 3.4.3** | `shared_buffers = 2GB`, `effective_cache_size = 6GB`, `work_mem = 32MB` | Mempercepat query spasial `ST_Contains` desa/kecamatan dan agregasi KSA/BPS |
| **Redis 7 (`jagapadi_v3_redis`)** | `maxmemory 512mb` (`allkeys-lru` / queue) | Sangat cukup untuk antrean job scraper, cache agregat dashboard, dan sesi |
| **Host Windows 11 Pro + Laragon** | Tersisa **±20 GB** | Tetap leluasa untuk sistem legacy (`jagapadi-3509`), MySQL 8.0.30, dan operasional harian IPDS |

### Contoh Konfigurasi `C:\Users\IPDS\.wslconfig`

```ini
[wsl2]
memory=12GB
processors=3
swap=4GB
localhostForwarding=true
```

---

## 4. Checklist Kesiapan Operasional Server (Hardening Host)

- [x] **Docker Desktop & WSL2 Backend:** Aktif dan berjalan dengan 3 container inti berstatus `healthy` (`jagapadi_v3_postgres`, `jagapadi_v3_redis`, `jagapadi_v3_mailpit`).
- [x] **Isolasi Port Loopback:** Port `5432` (PostgreSQL), `16379` (Redis), serta `8025`/`1025` (Mailpit) diikat ke `127.0.0.1` agar tidak terekspos langsung ke jaringan luar.
- [ ] **Pengaturan Daya (Power Plan):** Pastikan mode *Sleep* dan *Hibernate* diatur ke **Never** saat PC menyala agar server tidak mati di luar jam kerja.
- [ ] **Auto-Start Docker Desktop:** Aktifkan *"Start Docker Desktop when you sign in to your computer"* pada pengaturan Docker Desktop.
- [ ] **Manajemen Ruang Penyimpanan (±335 GB tersisa):** Jadwalkan pembersihan berkala (`docker system prune`) dan rotasi log agar partisi utama tidak penuh.
