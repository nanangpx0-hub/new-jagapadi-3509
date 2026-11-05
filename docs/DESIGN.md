# JAGAPADI v3 — Design Brief & Token Sistem (DRAFT v2 — menunggu Validasi Lapangan)

> Status: **DRAFT v2** — arah sudah dikunci pemilik (Kartografi Ladang, hijau + kuning padi, Bricolage + Public Sans), **belum baseline**. Wajib lulus **gerbang validasi lapangan** (§9) sebelum dikunci.
> Tanggal: 2026-11-05 (WIB) — revisi dari v1
> Berlaku untuk: `apps/web` (React 19 + Vite + Tailwind v3 PWA)
> Metode: proses dua-tahap ala skill `frontend-design` (Anthropic): **rencanakan token → review terhadap brief → baru bangun → kritik dengan screenshot**.
> Acuan: `docs/BLUEPRINT.md` (§4.2, §7, §8), `docs/PRD.md`, `docs/ROADMAP.md`, kondisi UI aktual (`apps/web/src/App.tsx`, `index.css`, `tailwind.config.js`, `vite.config.ts`).
>
> **Perubahan v1 → v2:** (1) signature "cap nomor laporan" **dihapus**; keberanian dialihkan ke perlakuan tipografi display; (2) **mode gelap dirancang sejak awal** (sebelumnya ditunda ke Fase 5); (3) seluruh rasio kontras **dihitung ulang**, 2 token diperbaiki (`tinta-3`, klaim `sawah-*`/`padi-400`); (4) gerbang validasi lapangan eksplisit sebelum token dikunci; (5) semua angka kontras di §3 sudah terverifikasi.

---

## 1. Brief Desain (dikunci dulu, baru estetika)

| Aspek | Isi |
|---|---|
| Produk | JAGAPADI v3 — Sistem Pelaporan & Analitik Pertanian Geospasial Kabupaten Jember (BPS 3509) |
| Audiens | **Petugas lapangan (POPT)** di lapangan; **statistisi** (verifikator) & **operator** di kantor; **pimpinan (viewer)** sebagai pembaca; **admin** sebagai pengelola |
| Pekerjaan utama | Petugas: *catat & kirim laporan dengan cepat dan akurat, walau sinyal lemah dan layar terkena matahari*. Statistisi: *verifikasi antrian laporan dengan andal*. Pimpinan: *membaca tren tanpa pelatihan* |
| Konteks pemakaian | Android kelas menengah-bawah, outdoor (terik matahari), satu tangan, gangguan sinyal; Bahasa Indonesia; WIB (`Asia/Jakarta`); sesi kantor untuk entri & verifikasi. Pengguna boleh memilih mode **terang (default outdoor)** atau **gelap** (kantor/cahaya redup) — keduanya dibangun sejak Fase 2 |
| Batasan keras (dari BLUEPRINT §8 & PRD) | WCAG 2.1 AA minimal, target AAA teks tubuh · kontras tinggi outdoor · Bahasa Indonesia · mobile-first PWA · target sentuh ≥ 44 px · timezone konsisten · offline-first |
| Yang BUKAN tujuan | Identitas "studio" eksperimental; gaya marketing/landing; dekorasi yang menambah beban unduh di jaringan lemah |

**Aturan main:** brief di atas menang atas selera. Skill `frontend-design` dipakai untuk *eksekusi* (anti-generik, token disiplin, copy yang jelas) — bukan untuk memberi lisensi desain yang mengalahkan kejelasan operasional.

---

## 2. Konsep Arah Visual: "Kartografi Ladang"

Bahasa visual diambil dari dunia subjeknya sendiri: **peta survei pertanian dan buku lapangan petugas** — bukan dari template admin panel.

- **Tanpa cap/stempel.** (Keputusan v2 — mohon tidak dikembalikan.) Keberanian tunggal dialihkan ke **perlakuan tipografi display**: *wordmark* "JAGAPADI", judul layar (H1), dan angka-angka besar KPI memakai **Bricolage Grotesque** dengan tracking rapat dan berat tebal — tipe sebagai elemen aktif, bukan kendaraan netral. Tidak ada rotasi, border ganda, atau kemiripan dokumen resmi.
- **Sisanya quiet:** panel hairline-border (tanpa bayangan seragam — menghindari "SaaS card kit"), satu keluarga display + satu keluarga UI, ikon garis tunggal (lucide), ruang napas lega di alur lapor, rapat di tabel data.
- **Identitas institusional, bukan dekoratif:** hijau dalam khas "papan nama balai pertanian", tinta kehijauan (bukan hitam/biru netral), aksen kuning padi untuk aksi primer di atas gelap. Tanpa gradasi ungu, tanpa krim+terakota+serif, tanpa ALL-CAPS eyebrow.

### Prinsip (dipakai untuk review setiap layar)

1. **Satu layar, satu pekerjaan.** Tepat satu aksi primer yang jelas; sisanya sekunder.
2. **Lapangan dulu.** Target & kontras diverifikasi untuk skenario matahari langsung; mode terang adalah default.
3. **Struktur = informasi.** Border, nomor urut, dan badge hanya bila mengkodekan urutan/status nyata (kode desa, nomor laporan, status lifecycle) — bukan hiasan.
4. **Bahasa pengguna, bukan bahasa sistem.** "Kirim laporan" bukan "Submit"; "Verifikasi" bukan "Approve"; pesan error menyebut apa yang terjadi dan cara memperbaikinya.
5. **Tenang di kantor, tegas di lapangan.** Ketegasan visual ada pada tipografi display, bobot CTA, dan status yang jelas — bukan pada ornamen.

---

## 3. Design Tokens

Semua token diimplementasikan sebagai **CSS variables** di `src/index.css`; Tailwind mereferensikan lewat `colors` (`tailwind.config.js`), dengan strategi `darkMode: 'class'` pada elemen `<html data-theme>` / `.dark`. Tidak ada nilai hex ad-hoc di komponen.

### 3.1 Warna — Mode Terang (default)

| Token | Hex | Peran | Kontras terverifikasi |
|---|---|---|---|
| `sawah-950` | `#133D2B` | Latar gelap (header, layar masuk) | vs putih **12.14:1** ✅ AAA |
| `sawah-800` | `#175438` | Permukaan hijau tua sekunder | vs putih **8.89:1** ✅ AAA |
| `sawah-700` | `#1E5B3E` | Aksi primer di atas terang (hover/solid) | vs putih **8.01:1** ✅ AAA |
| `padi-400` | `#E9B44C` | Aksen aksi primer **di atas latar gelap saja** | vs `sawah-950` **6.41:1** ✅ AA-large/UI |
| `latar` | `#F5F6F2` | Latar halaman (off-white netral, bukan krim `#F4F1EA`) | — |
| `tinta` | `#1B2A21` | Teks utama | vs `latar` **13.82:1** ✅ AAA |
| `tinta-2` | `#4A5A50` | Teks sekunder | vs `latar` **6.74:1** ✅ AA |
| `tinta-3` | `#57685C` | Teks tersier/caption (v2: dipergelap dari `#6B7A70` yang hanya 4.17:1) | vs `latar` **5.47:1** ✅ AA |
| `garis` | `#DDE0DA` | Hairline border (elemen non-teks) | vs `latar` **1.23:1** — cukup untuk hairline, bukan untuk batas grafis penting |

**Semantik status laporan — mode terang** (selalu berpasangan ikon + teks; tidak pernah warna saja; aman buta warna):

| Status (nilai DB) | Label UI | Hex | Kontras vs `latar` |
|---|---|---|---|
| `Draf` | Draf | `#475569` | **6.98:1** ✅ |
| `Submitted` | Dikirim | `#1D4ED8` | **6.17:1** ✅ |
| `Diverifikasi` | Diverifikasi | `#166534` | **6.57:1** ✅ |
| `Ditolak` | Ditolak | `#B91C1C` | **5.96:1** ✅ |
| `Diarsipkan` | Diarsipkan | `#4B5563` | **6.96:1** ✅ |
| Peringatan koordinat (`is_coordinate_mismatch`) | "Titik di luar batas desa" | `#B45309` | **4.63:1** ✅ (gunakan + ikon segitiga) |

Fokus keyboard — terang: `#1D4ED8` (**6.17:1**); di atas gelap: `#FCD34D` (**8.42:1** vs `sawah-950`).

> `padi-400` **bukan** warna teks di atas latar terang (**1.89:1** vs putih — gagal). Khusus aksi/aksen di atas `sawah-950`/`latar-gelap`.

### 3.1b Warna — Mode Gelap (dibangun sejak Fase 2)

| Token | Hex | Peran | Kontras terverifikasi |
|---|---|---|---|
| `latar-gelap` | `#101E16` | Latar halaman gelap (hijau nyaris hitam, bukan `#0B0B0B`) | vs `tinta-gelap` **14.66:1** ✅ AAA |
| `panel-gelap` | `#182A20` | Panel/kartu di atas latar gelap | vs `tinta-gelap` **12.85:1** ✅ AAA |
| `tinta-gelap` | `#E9EEE9` | Teks utama di gelap (off-white kehijauan) | 14.66:1 / 12.85:1 ✅ |
| `tinta-2-gelap` | `#A9B8AD` | Teks sekunder di gelap | vs `latar-gelap` **8.32:1** ✅ AAA |
| `garis-gelap` | `#2A3B2F` | Hairline border di gelap | cukup sebagai hairline non-teks |
| `padi-400` | `#E9B44C` | Aksi primer di gelap (tetap dipakai) | vs `latar-gelap` **9.10:1** ✅ AAA |
| Fokus | `#FCD34D` | Ring fokus di gelap | vs `latar-gelap` **11.94:1** ✅ AAA |

**Semantik status — mode gelap** (varian terang dari hue yang sama; semua ≥ 9:1):

| Status | Label | Hex (gelap) | Kontras vs `latar-gelap` |
|---|---|---|---|
| Draf | Draf | `#CBD5E1` | **11.60:1** ✅ |
| Dikirim | Dikirim | `#93C5FD` | **9.55:1** ✅ |
| Diverifikasi | Diverifikasi | `#86EFAC` | **12.27:1** ✅ |
| Ditolak | Ditolak | `#FCA5A5` | **9.07:1** ✅ |
| Diarsipkan | Diarsipkan | `#B8C2BB` | **9.41:1** ✅ |
| Peringatan koordinat | "Titik di luar batas desa" | `#FDE68A` | **13.83:1** ✅ |

**Aturan mode:** default mengikuti `prefers-color-scheme`; toggle manual (terang/gelap/sistem) di menu pengaturan, disimpan di `localStorage`. Meta `theme-color` tunggal (`#133D2B`) — opsional ditambah varian `media="(prefers-color-scheme: dark)"` nanti; `icon.svg` harus terbaca di kedua mode. Mode gelap **bukan** "near-black + acid green": hijau tetap dalam, teks off-white, aksen padi.

**Dataviz (Fase 3):** palet kategorikal aman buta warna Okabe–Ito (`#0072B2`, `#E69F00`, `#009E73`, `#D55E00`, `#CC79A7`, `#56B4E9`); choropleth single-hue sekuensial hijau `latar → sawah-950` (`#EAF3EC, #D2E6D8, #A9CDB6, #6FA988, #3F7A58, #133D2B`); selalu dengan legenda & label langsung bila memungkinkan; varian gelap memakai urutan yang sama dengan latar `#101E16`.

### 3.2 Tipografi

| Peran | Typeface | Catatan |
|---|---|---|
| Display / wordmark / H1 / angka KPI | **Bricolage Grotesque** (Variable, OFL) | **Satu-satunya tempat berani** (v2): tracking rapat, berat 650–800; tanpa ornamen |
| Teks UI & body | **Public Sans** (Variable, OFL) | Legibility kelas government-grade; netral, terbaca di layar kecil & silau |
| Data & kode (nomor laporan, kode BPS, koordinat) | **IBM Plex Mono** (400/500, OFL) | Hanya untuk data teknis; **bukan** label dekoratif |

- Self-host via `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/public-sans`, `@fontsource/ibm-plex-mono`; subset `latin` saja. Total ≤ ~120 KB woff2; tanpa request CDN (offline-first).
- Skala (minor third, per *Elements of Typographic Style*): `12 / 14 / 16 / 19 / 23 / 28 / 34 / 41` px; line-height body **1.55**, heading **1.2**; panjang baris teks baca ≤ **75 ch**.
- Headline memakai Bricolage; jangan tambah keluarga ketiga. Jangan Inter/Roboto/Arial sebagai default.

### 3.3 Layout & bentuk

- Radius: `--radius-sm: 6px` (input, badge), `--radius-md: 10px` (panel), `--radius-lg: 14px` (layar masuk/kartu besar). Hindari radius seragam untuk semua hierarki.
- Border: `1px solid var(--garis)` (terang) / `var(--garis-gelap)`; bayangan hanya untuk elemen yang benar-benar melayang (dropdown, toast), bukan setiap panel.
- Spacing: basis 4 px; konten laporan `max-w-3xl`; dashboard `max-w-7xl`.
- Alur lapangan (petugas): **satu kolom**, CTA primer melekat di bawah (sticky bottom bar); alur kantor (verifikasi/analisis): dua kolom — antrian + detail.

### 3.4 Ikon & media

- `lucide-react` (sudah dependency; belum dipakai) — stroke `2`, ukuran `20–24` px. Ganti semua emoji UI (📡🖼️💾⚙️) dengan ikon lucide.
- Foto laporan: thumbnail 96 px, klik untuk penuh; `loading="lazy"`.
- Logo: pakai **logo resmi BPS** bila tersedia; jangan mengarang logo. Wordmark sementara: "JAGAPADI" + "Kabupaten Jember".

### 3.5 Motion

- Hanya motion yang menjelaskan perubahan: buka/tutup antrian, simpan draf → toast, transisi status badge.
- `prefers-reduced-motion: reduce` → animasi non-esensial dimatikan.
- Tanpa fade-and-slide-up per seksi; tanpa hover-scale per kartu; tanpa animasi "kemenangan" submit.

---

## 4. Copy & Bahasa (aturan ringkas)

- Bahasa Indonesia, kalimat aktif, kata kerja plain: **Simpan draf · Kirim laporan · Verifikasi · Tolak · Arsipkan · Masuk · Keluar**.
- Satu aksi = satu nama, konsisten dari tombol → toast → status ("Laporan terkirim", bukan "Data berhasil disubmit").
- Error = sebab + tindakan: *"Minimal 1 foto wajib diisi sebelum laporan dikirim. Ambil foto kondisi lahan."* Bukan *"Validasi gagal."*
- Empty state mengundang aksi: *"Belum ada laporan Hama. Ketuk + Lapor untuk membuat draf pertama."*
- Label status UI: `Draf`, `Dikirim`, `Diverifikasi`, `Ditolak`, `Diarsipkan` (PRD §98; nilai DB tetap).
- Angka & tanggal: format `id-ID` (`5 Nov 2026, 13.45 WIB`); ribuan titik, desimal koma; nomor laporan & kode BPS mono.
- Dilarang: ALL-CAPS dekoratif, eyebrow di atas setiap heading, `→` di akhir teks tombol, "Silakan" tanpa makna.

---

## 5. Contoh Wireframe (alur lapor petugas — mobile)

```text
┌─────────────────────────────────────┐
│  ←  Lapor Hama            Draf ●    │  ← chip status (status-draf + ikon)
├─────────────────────────────────────┤
│  Desa/Kelurahan *                   │
│  [3509010006 — Jambesari        ▾]  │
│  ⚠ Titik GPS di luar batas desa     │  ← banner status-peringatan + ikon
│  [Ambil titik GPS]                  │
│                                     │
│  OPT *            [wereng cokelat ▾]│
│  Luas serangan *  [ 1,5 ] ha        │
│  Foto kondisi lahan *               │
│  [＋] [foto][foto]                   │  ← min. 1 foto; kompres WebP
│                                     │
│  Catatan                            │
│  [____________________________]     │
╞═════════════════════════════════════╡
│ [Simpan draf]      [Kirim laporan]  │  ← sticky; Kirim = padi-400 di atas
└─────────────────────────────────────┘     sawah-950, tinta gelap
```

Layar sukses setelah kirim (sederhana, **tanpa cap**):

```text
┌─────────────────────────────────────┐
│            ( ✓ )                    │  ← ikon check, lingkaran sawah-700
│      Laporan terkirim               │  ← H1 Bricolage, tegas
│  Nomor laporan Anda:                │
│  LH-20261105-0001                   │  ← blok mono, hairline border,
│                                     │     rata kiri, tanpa rotasi
│  Petugas verifikasi akan meninjau.  │
│  [Lihat laporan]   [Lapor lagi]     │
└─────────────────────────────────────┘
```

Antrian verifikasi (desktop, dua kolom):

```text
┌──────────────┬──────────────────────────────────────┐
│ Antrian (12) │  LH-20261105-0003 · Hama             │
│ ───────────  │  Petugas: Siti Aminah · 5 Nov 13.20  │
│ LH-…-0003   ●│  Desa: 3509010006 Jambesari          │
│ LH-…-0004    │  ⚠ Titik 1,2 km di luar batas desa   │
│ LH-…-0005    │  [Peta lokasi]  [Foto 1] [Foto 2]    │
│ …            │  Catatan petugas: "…"                │
│              │  [Tolak…]            [Verifikasi]    │
└──────────────┴──────────────────────────────────────┘
```

---

## 6. Yang Berubah vs UI Saat Ini

| Area | Sekarang | Usulan |
|---|---|---|
| Header | `bg-green-800` + bayangan | `sawah-950`, hairline border bawah, wordmark Bricolage |
| Latar / teks | `#f8fafc` / `slate-*` | `latar` / `tinta`, `tinta-2`, `tinta-3` |
| Font | `system-ui` | Public Sans (UI) + Bricolage Grotesque (display) + Plex Mono (data) |
| Mode | terang saja | **terang + gelap** sejak Fase 2 (`class` strategy, CSS variables) |
| Tombol primer | amber/green ad-hoc | `padi-400` di atas gelap / `sawah-700` di atas terang — satu pola |
| Status laporan | belum ada | Badge semantik §3.1 + ikon lucide (`FileClock, Send, BadgeCheck, XCircle, Archive`) |
| Emoji UI | 📡🖼️💾⚙️ | Ikon lucide stroke-2 |
| Kartu/panel | radius & shadow seragam | radius per hierarki, hairline border, shadow hanya untuk floating |
| Focus ring | `#1d4ed8` 3px | terang `#1D4ED8`; gelap `#FCD34D` |
| `theme-color` & manifest PWA | `#15803d` / `#f8fafc` | `#133D2B` (keduanya) / `#F5F6F2` |
| H1 & angka KPI | `font-extrabold system-ui` | Bricolage Grotesque 650–800, tracking rapat |

Tetap dipertahankan: target sentuh ≥ 44 px, `touch-action: manipulation`, focus-visible, `CascadingRegionSelect`, TanStack Query.

---

## 7. Rencana Implementasi & Gerbang Validasi

1. **Fase 2 (sekarang):** token CSS variables (terang + gelap) di `index.css`; `darkMode: 'class'` di Tailwind; toggle tema (sistem/terang/gelap) di pengaturan; self-host 3 font; komponen inti: `Button`, `Panel`, `StatusBadge`, `EmptyState`, `Field`, `StickyActionBar`. Bangun UI laporan & antrian verifikasi langsung dengan token (bukan retrofit kemudian).
2. **Retrofit shell Fase 1** (header/tab/login) ke token + mode gelap.
3. **Fase 3:** token dataviz; dashboard KPI (Bricolage untuk angka besar); peta choropleth.
4. **GERBANG VALIDASI LAPANGAN (wajib sebelum token dikunci baseline):** uji keterbacaan ke **2–3 petugas lapangan** di bawah matahari langsung (form laporan, banner peringatan, CTA sticky; keduanya mode terang & gelap) + 1 statistisi untuk antrian verifikasi; catat temuan; revisi token; baru dokumen ini naik status menjadi *baseline v1.0* di Fase 5 (bersama audit UAT/SUS).

**Checklist review tiap PR UI:** kontras teks ≥ 4.5:1 (target 7:1) · fokus keyboard terlihat di kedua mode · target ≥ 44 px · status tidak pernah warna-saja · tidak ada ALL-CAPS dekoratif · copy menyebut aksi nyata · 0 request font/CDN eksternal · lolos `prefers-reduced-motion` · tampilan benar di **kedua** mode.

---

## 8. Anti-Pattern yang Dilarang di Codebase Ini

- Krim `#F4F1EA` + terakota + serif; near-black + hijau asam; gradasi ungu–biru.
- **Cap/stempel "dokumen resmi" pada nomor laporan** (ditolak v2) dan gimmick sejenis (rotasi, border ganda).
- "SaaS card kit": kartu radius-seragam + shadow kecil di semua tempat + ikon dalam lingkaran pastel.
- Eyebrow ALL-CAPS di atas setiap heading; angka "01/02/03" untuk konten yang bukan urutan.
- Inter/system-ui sebagai "keputusan tipografi" tanpa diskusi.
- Warna sebagai satu-satunya pembawa makna status.
- Keluarga font keempat; font dari CDN; emoji sebagai ikon; hex langsung di komponen (selalu lewat token).

---

## 9. Pertanyaan Terbuka & Status Keputusan

**Sudah diputuskan (2026-11-05):** arah "Kartografi Ladang" (hijau + kuning padi) ✅ · tipografi Bricolage + Public Sans (+ Plex Mono data) ✅ · cap nomor laporan **ditolak** ✅ · mode terang **dan** gelap sejak awal ✅ · validasi 2–3 petugas sebelum token dikunci ✅.

**Masih terbuka:**
1. **Merek resmi BPS**: apakah ada logo/warna resmi yang wajib dipakai? Jika ada, `sawah`/`padi` disesuaikan.
2. **Ambang & lokasi toggle tema**: di header layar masuk saja, atau di semua layar (menu pengaturan)?
3. **Choropleth mode gelap**: perlu ramp sekuensial alternatif (hijau di atas `#101E16` mudah banding-banding buruk) — diputuskan saat Fase 3.
4. **Kriteria kelulusan validasi lapangan** (mis. ≥ 80% petugas membaca status & CTA tanpa ragu) — disusun bersama pemilik produk sebelum uji dilakukan.

---

## 10. Riwayat

| Tanggal | Perubahan |
|---|---|
| 2026-11-05 | v1 draft awal: brief, konsep Kartografi Ladang, token terang, cap nomor laporan sebagai signature, aturan copy, wireframe. |
| 2026-11-05 | **v2 (revisi):** cap nomor laporan dihapus (keputusan pemilik); keberanian dialihkan ke tipografi Bricolage; **mode gelap dirancang penuh** (§3.1b); semua rasio kontras dihitung ulang — `tinta-3` diperbaiki `#6B7A70`→`#57685C` (5.47:1), klaim `sawah-800` 9.6→8.89:1, `sawah-700` 7.4→8.01:1, `padi-400` 7.5→6.41:1 (vs `sawah-950`) & 9.10:1 (vs `latar-gelap`); gerbang validasi lapangan eksplisit (§7, §9); aturan & anti-pattern disesuaikan. Menunggu validasi lapangan → baseline v1.0. |
