# JAGAPADI v3 — Design Brief & Token Sistem (v3 — Arah Visual DISETUJUI PEMILIK)

> Status: **v3.2 — arah visual disetujui + Fase 3.5 disahkan pemilik**. Belum baseline final: wajib lulus **gerbang validasi lapangan** (§8; permukaan C: mitra statistik BPS / PPL / petugas TPHP kec.; permukaan B: 3–5 warga/petani); sisa keputusan §9 terbuka.
> Tanggal: 2026-11-05 (WIB)
> Berlaku untuk: **tiga permukaan** — (A) Admin/Backend, (B) Website Publik, (C) Android PWA, semua di `apps/web` kecuali diputuskan lain (§9).
> Acuan: `docs/BLUEPRINT.md`, `docs/PRD.md`, `docs/ROADMAP.md`, contoh tampilan pemilik (mockup 3-panel "SIAGALAHAN", nama produk tetap **JAGAPADI**), `docs/DESIGN.md` v2 (superseded).
>
> **Perubahan v2 → v3:** (1) arah visual berganti dari "Kartografi Ladang" (tenang, hairline) ke **full adopsi mockup**: sidebar hijau gelap, kartu radius besar + soft shadow + **pastel tint per status/kategori**, CTA hijau solid, peta-sentris; (2) **Website Publik masuk scope** (permukaan baru, di luar ROADMAP — butuh amandamen, §9); (3) seluruh tiga permukaan didefinisikan; (4) mode gelap tetap dirancang (adaptasi pastel → tint transparan + teks berwarna); (5) aturan status **tetap enum PRD** — status asing dari mockup ("Ditugaskan") TIDAK diimpor; (6) rasio kontras diverifikasi ulang.

---

## 1. Brief Desain

| Aspek | Isi |
|---|---|
| Produk | JAGAPADI v3 — Sistem Pelaporan & Analitik Pertanian Geospasial Kabupaten Jember (BPS 3509) |
| Audiens | **(A) Admin/Backend:** admin, operator, statistisi, pimpinan (viewer) — desktop-first. **(B) Website Publik:** warga Jember — terutama petani/poktan & umum — read-most. **(C) Android PWA:** **mitra statistik BPS Kabupaten Jember & PPL / petugas pengolah data tingkat kecamatan Dinas TPHP Kabupaten Jember** — mobile-first, outdoor |
| Pekerjaan utama | A: verifikasi & pantau laporan di peta. B: mengenali kondisi pertanian sekitar & melapor/melihat kejadian. C: lapor cepat dari lapangan, sinyal lemah |
| Konteks | A: kantor, monitor. C: Android kelas menengah-bawah, terik matahari, satu tangan. B: browser umum, publik |
| Batasan keras | WCAG 2.1 AA (AAA target teks tubuh) · kontras tinggi outdoor (permukaan C) · Bahasa Indonesia · WIB · offline-first (C) · target sentuh ≥ 44 px · **enum status PRD** (`Draf/Submitted/Diverifikasi/Ditolak/Diarsipkan`) · **6 domain laporan PRD** |
| Tagline kandidat (dari mockup, opsional) | "Data cepat. Tindakan tepat. Pertanian lebih tangguh." |
| Yang BUKAN tujuan | Identitas "studio" eksperimental; dekorasi tanpa fungsi; status/domain di luar PRD; klaim logo resmi BPS tanpa file resmi |

---

## 2. Konsep Arah Visual (Full Adopsi Mockup)

Bahasa visual dari mockup pemilik: **"peta pertanian aktif"** — permukaan kerja yang hidup, hijau dalam institusional, pastel lembut untuk pengelompokan informasi, peta sebagai jangkar dashboard.

- **Identitas inti:** hijau dalam (`sawah-950`) untuk sidebar & panel gelap; latar off-white kehijauan; tombol primer hijau solid; kartu besar radius 18px dengan soft shadow; angka KPI besar; chip berwarna lembut per status/kategori.
- **Peta selalu terlihat:** dashboard admin & halaman publik sama-sama menyandarkan ke peta tematik Jember (MapLibre/Leaflet, marker kategori berwarna + legenda) — bukan tabel belaka.
- **Ikon keluarga `Sprout/Leaf`:** daun tunas untuk brand mark (lucide `Sprout`); kategori laporan memakai ikon spesifik: Hama (`Bug`/`Leaf`), Penyakit (`Cross`/`ShieldPlus`), Genangan (`Waves`), Kekeringan (`Sun`) — plus domain lain: Pupuk (`FlaskConical`), Panen (`Wheat`), Cuaca (`CloudRain`), Alat-Sarana (`Tractor`).
- **Nama tetap JAGAPADI;** wordmark: ikon Sprout + "JAGAPADI" (Bricolage Grotesque 700, tracking rapat) + subline "Kabupaten Jember".

### Prinsip (review tiap layar)

1. **Satu layar, satu pekerjaan.** Satu CTA primer per layar (A: Verifikasi/Tolak kontekstual; B: Buat Laporan; C: Buat Laporan).
2. **Lapangan dulu** (permukaan C): kontras outdoor, target ≥ 44 px, mode terang default.
3. **Warna menjelaskan kategori/status** — selalu dipadu ikon + label; tidak pernah warna-saja.
4. **Bahasa pengguna** — aksi sesuai kata yang dipakai tombol → toast → status.
5. **Dekatkan keputusan ke peta** — lokasi adalah dimensi utama laporan; tampilkan peta/koordinat di detail, bukan sebagai lampiran.

---

## 3. Design Tokens

Implementasi: CSS variables di `src/index.css` + `darkMode: 'class'`; Tailwind mereferensikan variable (tidak ada hex ad-hoc di komponen).

### 3.1 Warna — Mode Terang (default)

| Token | Hex | Peran | Kontras terverifikasi |
|---|---|---|---|
| `latar` | `#F2F7F0` | Latar halaman (off-white kehijauan) | — |
| `tinta` | `#1B2A21` | Teks utama | 13.82:1 ✅ AAA |
| `tinta-2` | `#4A5A50` | Teks sekunder | 6.74:1 ✅ AA |
| `tinta-3` | `#57685C` | Teks tersier/caption | 5.46:1 ✅ AA |
| `sawah-950` | `#133D2B` | Sidebar admin, panel gelap, CTA di atas gelap | vs putih 12.14:1 ✅ AAA |
| `sawah-800` | `#175438` | Permukaan hijau tua sekunder | vs putih 8.89:1 ✅ AAA |
| `sawah-700` | `#1E5B3E` | **CTA hijau solid** (teks putih) | vs putih 8.01:1 ✅ AAA |
| `padi-400` | `#E9B44C` | Aksen/badge "menunggu" di atas gelap saja | vs `sawah-950` 6.41:1 ✅ |
| `garis` | `#DDE5DC` | Hairline border & divider | hairline non-teks |

**Kartu pastel (KPI & chip)** — angka besar (≥ 28 px bold) & label `tinta-2`:

| Kartu/chip | Latar tint | Teks/ikon utama | Kontras |
|---|---|---|---|
| KPI "Laporan" / positif | `#E7F4EA` | `#14532D` | 8.04:1 ✅ |
| KPI "Perlu Verifikasi" / peringatan | `#FCF3D9` | `#B45309`* | 4.53:1 ✅ (teks besar) |
| KPI "Ditangani" / info | `#E3ECFB` | `#1D4ED8` | 5.63:1 ✅ |
| Chip amber (mis. "Dikirim"?) — gunakan untuk "Menunggu" | `#FDE68A` | `#92400E` | 5.69:1 ✅ |
| Chip biru (mis. "Diproses") | `#BFDBFE` | `#1E40AF` | 6.14:1 ✅ |
| Chip hijau (mis. "Selesai"/"Diverifikasi") | `#A7F3D0` | `#065F46` | 5.99:1 ✅ |
| Chip merah (mis. "Ditolak") | `#FECACA` | `#991B1B` | 5.74:1 ✅ |

\* untuk label kecil di kartu amber gunakan `tinta-2` (6.4:1 di atas `#E7F4EA` analog) — jangan pakai amber kecil sebagai teks.

**Semantik status laporan (enum PRD — JANGAN tambah nilai):** `Draf`→chip abu `#F1F5F9/#475569` · `Submitted` (UI "Dikirim")→chip biru `#BFDBFE/#1E40AF` · `Diverifikasi`→chip hijau `#A7F3D0/#065F46` · `Ditolak`→chip merah `#FECACA/#991B1B` · `Diarsipkan`→chip abu tua `#E2E8F0/#4B5563`. Peringatan koordinat → chip amber `#FDE68A/#92400E` + ikon `TriangleAlert`.

### 3.1b Mode Gelap (dibangun sejak Fase 2)

| Token | Hex | Peran | Kontras |
|---|---|---|---|
| `latar-gelap` | `#101E16` | Latar gelap | vs `tinta-gelap` 14.66:1 ✅ |
| `panel-gelap` | `#182A20` | Panel/kartu | 12.85:1 ✅ |
| `tinta-gelap` | `#E9EEE9` | Teks utama | 14.66:1 ✅ |
| `tinta-2-gelap` | `#A9B8AD` | Teks sekunder | 8.32:1 ✅ |
| `garis-gelap` | `#2A3B2F` | Border hairline | non-teks |
| `padi-400` | `#E9B44C` | CTA primer di gelap | 9.10:1 ✅ |
| CTA hijau di gelap | `#2E7D4F` bg + `#EAF6EE` teks | tombol hijau solid versi gelap | ≥ 4.5:1 |
| Fokus | `#FCD34D` | ring fokus | 11.94:1 ✅ |

**Kartu pastel di gelap** = tint transparan + teks berwarna (bukan pastel pekat): hijau `rgba(74,222,128,.10)` + `#86EFAC` · amber `rgba(251,191,36,.12)` + `#FDE68A` · biru `rgba(96,165,250,.12)` + `#93C5FD` · merah `rgba(248,113,113,.12)` + `#FCA5A5` · abu `rgba(203,213,225,.10)` + `#CBD5E1`. **Chip status** memakai pasangan teks terang yang sama di atas tint transparan (≥ 9:1).

**Dataviz (Fase 3):** Okabe–Ito kategorikal; choropleth single-hue hijau; legenda selalu; mode gelap memakai urutan ramp sama di atas `#101E16`. Marker kategori peta: Hama `#16A34A` · Penyakit `#D97706` · Genangan/Banjir `#2563EB` · Kekeringan `#F59E0B` · Pupuk `#7C3AED` · Panen `#65A30D` · Cuaca `#0EA5E9` · Alat-Sarana `#78716C` — dengan ikon bentuk berbeda (lingkaran/segitiga/kotak) agar aman buta warna.

### 3.2 Tipografi

| Peran | Typeface | Catatan |
|---|---|---|
| Display: wordmark, H1, angka KPI besar, headline hero publik | **Bricolage Grotesque** (Variable, OFL) | Berat 650–800, tracking rapat |
| Teks UI & body | **Public Sans** (Variable, OFL) | Semua ukuran ≤ H3 |
| Data & kode (nomor laporan, kode BPS, koordinat) | **IBM Plex Mono** (400/500, OFL) | Bukan label dekoratif |

Self-host via Fontsource, subset `latin`, tanpa CDN. Skala 1.2: `12/14/16/19/23/28/34/41` px; line-height body 1.55, heading 1.2; baris baca ≤ 75 ch. (Mockup tampak memakai sans geometris bulat — Bricolage dipilih agar tetap legal/OFL, khas, dan satu rumpun dengan v2.)

### 3.3 Bentuk, bayangan, spacing

- Radius: `sm 8px` (input/chip) · `md 14px` (kartu KPI, panel) · `lg 18px` (hero, kartu besar, layar PWA) · tombol utama `full` (pill) sesuai mockup CTA.
- **Soft shadow (v3, menggantikan hairline-only v2):** `--shadow-card: 0 10px 30px rgb(19 61 43 / .10)`; `--shadow-pop: 0 16px 40px rgb(19 61 43 / .18)` — hanya kartu elevated & floating; tabel/antrian tetap hairline.
- Spacing basis 4 px; grid: admin `max-w-none` (sidebar 264 px + konten), publik `max-w-7xl`, PWA full-bleed mobile `px-4`.

### 3.4 Ikon & media

- `lucide-react`, stroke 2, 20–24 px. Ganti seluruh emoji di UI dengan ikon lucide.
- Foto hero publik & foto laporan: WebP, hero ≤ 300 KB (crop 21:9), alt text bermakna. Titik peta memakai divIcon berlabel ikon kategori.
- Logo: Sprout lucide di dalam lingkaran `sawah-950`/`latar` sesuai permukaan; wordmark "JAGAPADI". Jika BPS menyerahkan logo/ brand guideline resmi → ganti, token disesuaikan.

### 3.5 Motion

- Mikro: transisi warna/opacity 150–200 ms untuk hover & tab; toast masuk/keluar; buka/tutup panel detail.
- **Satu orkestrasi maksimal per permukaan:** B: fade-up hero sekali saat load (hormati `prefers-reduced-motion`); C: tidak ada animasi; A: none.
- Tanpa hover-zoom kartu; tanpa staggered list animation pada tabel/antrian.

---

## 4. Tiga Permukaan — Spesifikasi

### A. Admin/Backend (desktop-first) — mockup panel kiri

```text
Sidebar (264px, sawah-950)          Konten (latar)
┌───────────────┐ ┌───────────────────────────────────────┐
│ Sprout JAGAPADI│ Ringkasan Wilayah        🔔 [Admin ▾]  │
│  Kabupaten Jbr│ ┌────────┐┌────────┐┌─────────┐        │
│               │ │ 48     ││ 12     ││ 8       │        │
│ ▸ Ringkasan   │ │Laporan ││Perlu   ││Ditangani│        │
│ ▸ Peta Laporan│ └────────┘└────────┘└─────────┘        │
│ ▸ Verifikasi 12│ ┌───────────────────────────────┐      │
│ ▸ Penugasan   │ │ Peta Jember (marker kategori) │      │
│ ▸ Analitik    │ └───────────────────────────────┘      │
│               │ Antrean Verifikasi      Lihat Semua →  │
│               │ No │ Jenis │ Lokasi │ Tanggal │ Status │
└───────────────┘ └───────────────────────────────────────┘
```

- Sidebar: ikon+label; item aktif: pill `hijau` semi-terang + teks putih; badge jumlah di "Verifikasi".
- KPI: 3 kartu pastel + 1 aksen netral (v3: **4 kartu** — "Laporan" `#E7F4EA`, "Perlu Verifikasi" `#FCF3D9`, "Ditangani" `#E3ECFB`, opsional "Selesai Bulan Ini" `#EDE9FE→` diganti hijau muda `#E9F5DA`? gunakan `#E7F4EA` keluarga — jangan tambah hue ungu).
- Peta: layer batas kecamatan (PostGIS), marker per laporan aktif, legend chip kategori, kontrol zoom + locate; klik marker → panel ringkas (nomor, jenis, status, tombol "Buka").
- Antrean Verifikasi: tabel hairline, kolom No/Jenis/Lokasi/Tanggal/Status (chip), aksi hover; baris klik → detail (drawer kanan): foto, peta, `is_coordinate_mismatch` banner amber, catatan, tombol **Verifikasi** (`sawah-700`) / **Tolak…** (outline merah).
- "Penugasan" & "Analitik" = Fase 3/4 (placeholder route dengan empty state ber-ikon, bukan halaman kosong).

### B. Website Publik (BARU — lihat §9) — mockup panel tengah

```text
┌─────────────────────────────────────────────────────────┐
│ Sprout JAGAPADI   Peta Kejadian · Panduan · 🔍 · ☰      │
├─────────────────────────────────────────────────────────┤
│ ▓ foto sawah + overlay gelap                             │
│   Kenali kondisi sekitar. Laporkan lebih cepat.         │
│   Panen aman, hama terkendali.                          │
│   [ Buat Laporan ]   [ Lihat Peta ]                     │
├─────────────────────────────────────────────────────────┤
│ Pilih Kategori Laporan                                  │
│ ┌─Hama─┐ ┌─Penyakit─┐ ┌─Genangan─┐ ┌─Kekeringan─┐       │
├─────────────────────────────────────────────────────────┤
│ Peta Kejadian (read-only, marker kategori) │ Pembaruan  │
│ ───────────────────────────────────────────│ Kejadian ▸ │
│  (feed: thumbnail + tag status + kecamatan + waktu)     │
└─────────────────────────────────────────────────────────┘
```

- **Akses:** publik read-only untuk peta & pembaruan; "Buat Laporan" → jika pengunjung bukan petugas: arahan login/PWA (opsi: **formulir pengaduan publik dengan moderasi** — keputusan produk, §9). Data publik **tidak boleh** memuat PII pelapor; hanya agregat/kecamatan + status.
- Kategori publik (4 kartu) adalah **penyederhanaan tampilan**: Hama→`pest`, Penyakit→`pest` (sub-tipe), Genangan→`irrigation`, Kekeringan→`weather`. Pemetaan final 6 domain → keputusan produk (§9).
- Konten "Pembaruan Kejadian" = laporan *Diverifikasi* terpilih (kurasi otomatis: hanya Diverifikasi, tanpa PII) atau konten editorial BPS — keputusan konten (§9).
- SEO/prerender: pertimbangkan SSG untuk landing (Vite + vite-plugin? cukup SPA + meta tags untuk fase awal).

### C. Android PWA (mobile-first) — mockup panel kanan

```text
┌──────────────────────────┐
│ 9:41                     │
│ Sprout SiagaLahan → JAGAPADI   🔔︎│
│ Wilayah: Jember          │
│ ┌──────────────────────┐ │
│ │ ✎ Buat Laporan       │ │  ← CTA full-width sawah-700
│ └──────────────────────┘ │
│ ┌─⏱─ 2 diproses · 1 perlu data ─▶│  ← kartu hijau #E7F4EA
│ ┌─📄 2 laporan menunggu dikirim ▶│  ← kartu amber #FCF3D9
│ Laporan Terbaru          │
│ ┌──── foto ────[Menunggu Verifikasi]┐
│ │ Dugaan hama pada jagung          │
│ │ Kec. Sumberbaru · 12 Jun 09:24   │
│ └──────────────────────────────────┘
│ [Beranda] [Peta] [Laporan] [Akun]  ← bottom nav, aktif hijau
└──────────────────────────┘
```

- Header sticky: wordmark kecil + lonceng (badge count notifikasi) + "Wilayah: Jember" (dropdown ganti wilayah bila petugas ditugaskan lintas kecamatan — Fase lanjut).
- CTA primer = satu tombol besar; 2 kartu ringkasan status (jumlah diproses / menunggu kirim) — dari data nyata user login.
- "Laporan Terbaru": kartu foto penuh-lebar (16:10) + badge status amber "Dikirim"/"Menunggu Verifikasi" sesuai enum; tap → detail.
- **Bottom nav** (`fixed`, 4 item): Beranda (`House`), Peta (`Map`), Laporan (`FileText`), Akun (`CircleUserRound`); aktif = hijau + dot.
- Alur lapor: form satu kolom → draf lokal IndexedDB → kompres WebP → submit + `Idempotency-Key` → kartu status berubah; offline indicator chip saat `navigator.onLine === false`.

---

## 5. Copy & ikon (aturan tetap)

Aturan copy v2 tetap berlaku (bahasa pengguna, aktif, error = sebab+tindakan, `id-ID`). Penyesuaian v3:

- Tagline kandidat beranda publik: **"Data cepat. Tindakan tepat. Pertanian lebih tangguh."** (boleh diganti pemilik).
- Headline hero: **"Kenali kondisi sekitar. Laporkan lebih cepat."** (dari mockup; generik lintas domain — tidak menyebut domain tertentu).
- CTA publik: **"Buat Laporan"** / **"Lihat Peta"**. CTA PWA: sama. Admin: **"Verifikasi"** / **"Tolak…"** / **"Simpan draf"** / **"Kirim laporan"**.
- Status UI: `Draf · Dikirim · Diverifikasi · Ditolak · Diarsipkan` — **tidak ada** status lain; badge mockup "Menunggu Verifikasi" hanya *display synonym* untuk `Submitted` bila disetujui (default: tampilkan "Dikirim").

## 6. Ikon brand (lucide)

`Sprout` (logo) · kategori: `Bug`, `Leaf`, `Waves`, `Sun`, `FlaskConical`, `Wheat`, `CloudRain`, `Tractor` · status: `FileClock`, `Send`, `BadgeCheck`, `CircleX`, `Archive` · peringatan: `TriangleAlert` · nav: `House`, `Map`, `FileText`, `CircleUserRound` · aksi: `Pencil`/`PenLine` (lapor), `Search`, `Bell`, `ChevronRight`, `Plus`, `Camera`, `MapPin`.

## 7. Rencana Implementasi (tiga permukaan, inkremental)

1. **Fase 2 (sekarang):** token v3 di `index.css` (terang+gelap), `tailwind.config.js`, font self-host; komponen: `Button`, `Chip`, `KpiCard`, `Panel`, `StatusBadge`, `EmptyState`, `Field`, `MapView` (marker divIcon kategori), `BottomNav`, `StickyActionBar`. Bangun **C (PWA)** untuk alur laporan + **A** untuk antrian/verifikasi minimal (tabel + drawer). Retrofit shell/login.
2. **Fase 3:** KPI + peta choropleth (A), grafik analitik; **B (Website Publik) v1**: hero statis + kategori + peta read-only + pembaruan Diverifikasi terkurasi (tanpa PII); butuh **amandamen ROADMAP** (tambah permukaan/Fase publik) — §9.
3. **Fase 4/5:** "Penugasan" (A), monitoring publik penuh; uji lapangan C di bawah matahari; audit kontras; SUS; kunci baseline.
4. Setiap PR: checklist §7 DESIGN sebelumnya + tampilan benar di **kedua** mode + ketiga permukaan terdampak di-screenshot.

## 8. Gerbang Validasi (tetap berlaku)

Uji ke **2–3 mitra statistik BPS / PPL / petugas pengolah data TPHP se-kecamatan** (permukaan C, outdoor, terang+gelap — mereka adalah target pengguna sebenarnya; pemilik produk yang menunjuk respondennya) + **1 statistisi** (permukaan A, antrian) sebelum dikunci baseline. Untuk **B**: uji keterbacaan ke **3–5 warga/petani umum** (audiens publik); mitra/PPL dapat dipakai sebagai proxy dengan catatan kemungkinan bias. Kriteria kelulusan: ditetapkan pemilik produk (§9).

## 9. Keputusan Pemilik Produk & Status

**Diputuskan 2026-11-05 (sesi ini):**
1. ✅ Website Publik **ditambahkan** ke ROADMAP sebagai **Fase 3.5 — Kanal Publik & Komunikasi** (ROADMAP + BLUEPRINT diamandemen; dibaca publik tanpa login; CTA → PWA petugas).
2. ✅ Alur "Buat Laporan" publik: **diarahkan ke PWA petugas** (login). Tidak ada formulir publik bermoderasi pada fase ini.
3. ✅ Pemetaan 4 kategori publik → domain PRD disetujui: Hama→`pest`, Penyakit→`pest`, Genangan→`irrigation`, Kekeringan→`weather` (hanya penyederhanaan tampilan; data tetap enum PRD).

**Masih menunggu:**
4. **Arsitektur Website Publik**: rekomendasi sementara — route group publik di `apps/web` (satu SPA, lazy route `/`, `/peta`, `/panduan`, `/pembaruan`, shared design system) vs aplikasi terpisah `apps/public`. Menunggu putusan berbasis hosting/traffic.
5. **Sumber & lisensi foto hero sawah** (milik sendiri atau stock bebas lisensi) + **tile server peta produksi** (OSM dev; produksi: Geoportal/self-host/tile policy + atribusi).
6. **Logo/merek resmi BPS** — bila tersedia, menggantikan Sprout/wordmark.
7. **Badge "Menunggu Verifikasi"** untuk `Submitted` (display synonym) — boleh, atau tetap "Dikirim"?
8. **Tagline** — pakai "Data cepat. Tindakan tepat. Pertanian lebih tangguh."?
9. **Gerbang validasi (§8)** — termasuk **3–5 warga/petani** untuk Website Publik; pemilik produk menunjuk respondennya (mis. lewat kontak penyuluh/poktan/BPS). Kriteria kelulusan belum ditetapkan.

## 10. Anti-Pattern (v3)

- Status/domain di luar PRD demi menyerupai mockup ("Ditugaskan" dsb.) — **dilarang**.
- Pastel pekat sebagai teks kecil (kontras gagal) — teks kecil selalu `tinta`/`tinta-2` atau varian gelap §3.1b.
- Menyembunyikan `is_coordinate_mismatch` demi estetika — selalu tampil amber + ikon.
- PII pelapor di permukaan publik — agregat & kecamatan saja.
- Hex ad-hoc di komponen; font dari CDN; emoji sebagai ikon; animasi non-esensial.
- Mengunci token sebelum gerbang validasi §8 lulus.

## 11. Riwayat

| Tanggal | Perubahan |
|---|---|
| 2026-11-05 | v1 draft awal (Kartografi Ladang, cap nomor laporan). |
| 2026-11-05 | v2: cap dihapus; mode gelap dirancang; kontras dihitung ulang. |
| 2026-11-05 | **v3: full adopsi mockup pemilik** (`data/Desain/tampilan/generated-image.png`): tiga permukaan (A Admin/Backend, B **Website Publik — BARU**, C Android PWA); kartu radius 18px + soft shadow + pastel tint; CTA hijau solid; peta-sentris; bottom nav mobile; status tetap enum PRD; tagline kandidat; kontras kartu/chip diverifikasi (≥4.5:1); dark mode = tint transparan + teks terang; nama produk tetap JAGAPADI. Menunggu putusan §9 (amandamen ROADMAP + alur publik) & gerbang validasi §8. |
| 2026-11-05 | **v3.1: keputusan pemilik dikunci** — Website Publik resmi masuk ROADMAP sebagai **Fase 3.5** (BLUEPRINT ikut diamandemen); CTA publik → PWA petugas; pemetaan 4 kategori → domain PRD disetujui; ROADMAP.md & BLUEPRINT.md diperbarui. Masih terbuka: arsitektur B, foto hero, tile peta, merek BPS, badge synonym, tagline, kriteria & responden gerbang validasi (termasuk 3–5 warga/petani). |
| 2026-11-05 | **v3.2: komposisi pengguna diperjelas pemilik produk** — pengumpul laporan lapangan = **mitra statistik BPS Kabupaten Jember** (sekarang) + **PPL / petugas pengolah data TPHP se-kecamatan** (rencana). PRD §3.1 diamandemen; audiens C & responden §8 diperbarui. Sisa §9 terbuka. |
