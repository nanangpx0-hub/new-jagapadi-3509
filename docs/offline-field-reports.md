# Modul pelaporan offline: React 19, TypeScript, Vite

## Status implementasi

Ditambahkan empat modul pada `apps/web/src/offline/`:

- `compress-image.ts`: JPEG/PNG ke WebP, maksimum lebar 1280 px, target ketat kurang dari 300000 byte.
- `database.ts`: IndexedDB melalui idb, draft dan outbox, enqueue atomik, retry manual.
- `sync-engine.ts`: pengiriman multipart, idempotency key tetap, klaim lease lintas tab/worker, timeout dan retry.
- `use-offline-reports.ts`: hook React, event online/offline, timer retry, pemulihan saat tab aktif, notifikasi lintas tab.

Direktori apps/web belum memiliki manifest aplikasi saat diperiksa. Modul belum dipasang pada UI atau service worker, dan dependensi belum diinstal. Compiler global tsc tidak tersedia; typecheck/build serta pengujian browser belum dilakukan. Tidak ada klaim bahwa PWA sudah dapat diinstal atau bekerja offline setelah deployment.

## Integrasi dependensi

Saat menyiapkan package.json workspace frontend @jagapadi/web, gunakan React 19/react-dom 19 serta tambahkan idb sebagai dependency dan typescript, @types/react 19, @types/react-dom 19 sebagai devDependencies. Pasang Vite dan plugin React sesuai scaffold proyek. Jangan mengganti manifest root atau membuat build script yang mengarah ke entry point yang belum ada.

Opsi compiler yang diperlukan untuk modul ini mencakup target ES2022, module ESNext, moduleResolution Bundler, strict true, dan lib ES2022, DOM, DOM.Iterable. Bundle worker terpisah dengan konfigurasi library worker jika kelak dipakai. idb harus dibundel Vite, bukan diimpor sebagai bare import dari public service worker.

## Contoh integrasi komponen

```tsx
import { useState } from 'react';
import { compressPhoto } from './offline/compress-image';
import { saveDraft, requestPersistentStorage } from './offline/database';
import { useOfflineReports } from './offline/use-offline-reports';

// ownerId harus ID akun terautentikasi yang stabil, bukan nama tampilan.
export function ReportForm({ ownerId }: { ownerId: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const queue = useOfflineReports({
    ownerId,
    endpoint: '/api/reports',
    getSession: async () => {
      // Integrasikan auth store aplikasi di sini. Jangan sekadar mengembalikan
      // ownerId lama jika akun sudah logout/berubah saat request berlangsung.
      const current = await readCurrentAuthenticatedSession();
      if (!current || current.userId !== ownerId) return null;
      return { ownerId: current.userId, headers: current.requestHeaders };
    },
  });

  async function capture(file: File) {
    setBusy(true);
    try {
      const photo = await compressPhoto(file);
      const draftId = await saveDraft(ownerId, {
        form: { description: 'Contoh laporan; ganti dengan form sebenarnya' },
        photos: [{ name: 'field.webp', blob: photo.blob }],
      });
      setMessage('Draft tersimpan lokal.');
      // Untuk alur Simpan Draft saja, jangan panggil submitDraft.
      await queue.submitDraft(draftId);
      setMessage('Tersimpan di antrean perangkat; belum tentu diterima server.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan laporan');
    } finally {
      setBusy(false);
    }
  }

  return <section>
    <p>{queue.online ? 'Jaringan terdeteksi' : 'Offline'}; {queue.syncing ? 'memproses antrean' : 'siap'}</p>
    <input type="file" accept="image/jpeg,image/png" capture="environment" disabled={busy}
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        if (file) void capture(file);
        event.currentTarget.value = '';
      }} />
    <button type="button" onClick={() => void requestPersistentStorage().then(granted => {
      setMessage(granted ? 'Penyimpanan persisten diizinkan' : 'Penyimpanan tetap dapat dibersihkan browser');
    }).catch(() => setMessage('Permintaan penyimpanan persisten gagal'))}>
      Lindungi penyimpanan lokal
    </button>
    <button type="button" onClick={queue.syncNow}>Coba sinkronkan</button>
    <p role="status">{message || queue.lastError}</p>
  </section>;
}
```

`readCurrentAuthenticatedSession` adalah placeholder adapter auth yang HARUS dibuat aplikasi, bukan fungsi yang disediakan modul. Untuk Sanctum cookie, baca cookie XSRF-TOKEN dan kirim nilai terdekode sebagai X-XSRF-TOKEN sesuai konfigurasi backend. Untuk bearer token, berikan Authorization dari auth store yang aktif. Jangan menyimpan token di payload IndexedDB. getSession sebaiknya membaca state lokal dengan cepat; jika melakukan I/O, berikan timeout sendiri.

Gunakan satu instance hook pada root area terautentikasi, lalu bagikan lewat Context agar UI form tidak perlu membuat beberapa scheduler. navigator.onLine hanya petunjuk; jaringan terdeteksi belum tentu endpoint terjangkau. Status berhasil harus dibaca dari row outbox sync_status=synced, bukan dari submitDraft yang hanya memastikan enqueue lokal selesai.

## Kompresi dan orientasi

- Input JPEG/PNG; MIME kosong, HEIC, dan format lain ditolak dengan pesan yang harus ditampilkan pada pengguna.
- createImageBitmap memakai orientasi dari image; fallback memakai HTMLImageElement.
- Maksimum lebar 1280 px; implementasi juga membatasi tinggi 1280 px untuk menekan alokasi memori foto portrait.
- Rasio terjaga hingga pembulatan dimensi piksel; tidak memperbesar foto kecil.
- Coba kualitas WebP 0.86, 0.74, 0.62, 0.50, 0.38; bila perlu turunkan resolusi bertahap.
- Output selalu diperiksa MIME dan ukuran. Jika target gagal, fungsi melempar error; tidak menyimpan foto melebihi batas secara diam-diam.
- PNG transparan diratakan pada latar putih. Nama file upload dibentuk sendiri, bukan berasal dari path pengguna.
- Guard input 40 MB dan 80 megapiksel membantu membatasi penggunaan memori, tetapi pengecekan dimensi terjadi setelah decode; uji kamera perangkat kelas bawah.
- OffscreenCanvas tidak otomatis memindahkan kerja ke thread lain. Untuk menghindari jank, panggil compressPhoto dari dedicated worker yang dibundel Vite, tangani fallback ke main thread jika decoder/encoder worker tidak didukung. Kompresi utama tidak dilakukan dalam service worker sinkronisasi.
- Data koordinat laporan harus disimpan eksplisit pada form; jangan mengandalkan metadata GPS foto yang di-encode ulang.

## Skema dan jaminan transaksi

Database: jagapadi-field-reports, versi 1.

### drafts

Key path id; index by-owner. Row berisi id, client_uuid, owner_id, payload (form JSON + array Blob WebP), sync_status, created_at, updated_at.

### outbox

Key path id. Index unique by-client dan by-idempotency, serta by-next-attempt dan by-owner. Row berisi:

- id, client_uuid, idempotency_key, owner_id.
- payload: snapshot form dan Blob foto.
- retry_count, sync_status: draft | queued | syncing | failed | synced.
- next_attempt_at, lease_token, lease_until.
- last_error, created_at, updated_at; response_id disediakan pada tipe untuk integrasi masa depan tetapi belum diisi.

Row draft mulai sebagai draft; row outbox dibuat langsung sebagai queued. enqueueDraft mengubah status draft dan membuat row outbox dalam SATU transaksi. Enqueue berulang dari draft yang sama mengembalikan row yang sudah ada. Setelah queued, snapshot tidak boleh diedit; perubahan isi memerlukan draft baru beserta identitas baru. retryFailed hanya menjadwalkan ulang payload yang sama dengan key yang sama.

State lifecycle otoritatif sinkronisasi ada pada outbox. Row draft ditandai queued saat enqueue dan synced saat sukses; status retry_count/syncing/failed tidak disalin ke draft. Untuk UI progres, baca outbox berdasarkan client_uuid. getFieldDB tersedia untuk query idb tersebut. Gunakan revision dari hook untuk memuat ulang tampilan; ini bukan jumlah laporan tersinkron.

Klaim antrean menggunakan transaksi readwrite IndexedDB, sehingga beberapa tab/worker yang bekerja sama tidak mengambil row dengan lease aktif secara bersamaan. Lease 90 detik memulihkan row syncing yang tertinggal akibat crash. Lease dapat kedaluwarsa saat tab tersuspensi; karena itu idempotency backend tetap wajib.

Setelah sukses, Blob foto dilepas dari draft dan outbox untuk menghemat ruang; form dan metadata tetap dipertahankan. Tidak ada pembersihan otomatis row lama, ekspor cadangan, maupun penghapusan draft dalam implementasi awal.

## Retry dan timeout

- Timeout fetch 30 detik; kegagalan jaringan/timeout tetap memakai idempotency key lama karena server mungkin telah melakukan commit.
- HTTP 5xx, 408, 425, 429, dan respons pending 202 dijadwalkan ulang.
- Backoff sekitar 2 detik x 2^(retry_count-1), ceiling 5 menit, dengan jitter 50–100% ceiling. Retry-After dapat menunda lebih lama, dibatasi 24 jam.
- Maksimum 8 kegagalan sebelum failed; pengguna dapat mencoba kembali secara eksplisit tanpa mengganti key.
- HTTP 400/401/403/409/413/419/422 dan 4xx lain yang tidak disebut retryable masuk failed untuk review/auth; jangan mengulang validasi salah tanpa batas.
- 202 belum dianggap sukses final. Backend harus mengembalikan hasil final pada POST ulang dengan key sama, atau integrasikan status endpoint dan polling tersendiri.
- Semua respons 2xx selain 202 dianggap final sesuai kontrak backend. Jangan gunakan 200 untuk menyatakan kegagalan bisnis; kembalikan status HTTP yang sesuai.
- Payload multipart berisi client_uuid, payload sebagai JSON string, dan photos[]. Content-Type tidak diisi manual agar browser membuat boundary yang benar.
- Endpoint dibatasi same-origin. Gunakan proxy Vite/deployment jika backend Laravel berbeda origin.

## Kontrak Laravel: wajib sebelum produksi

Header Idempotency-Key saja tidak menjamin exactly-once. Backend harus mengimplementasikan ledger idempotensi persisten:

1. Autentikasi dan otorisasi akun pemilik laporan pada setiap request.
2. Unique constraint untuk (user_id, endpoint/scope, idempotency_key); tambahkan unique business key (user_id, client_uuid) pada laporan sebagai pertahanan kedua.
3. Simpan hash SEMANTIK form ternormalisasi dan hash isi foto. Jangan hash raw multipart karena boundary berubah setiap retry.
4. Akuisisi key secara atomik sebelum side effect; key sama + payload berbeda menghasilkan 409, bukan overwrite.
5. Hubungkan pembuatan laporan dan ledger dalam transaksi database; tangani penyimpanan file eksternal agar retry tidak membuat foto ganda/orphan.
6. Setelah commit, simpan status HTTP dan body respons final; replay request mengembalikan respons konsisten tanpa membuat laporan kedua.
7. Untuk key yang masih diproses, kembalikan misalnya 425 atau 202 dengan Retry-After; engine ini memperlakukannya sebagai pending/retryable. Jangan mengembalikan 409 untuk kondisi sementara jika ingin retry otomatis dengan engine ini.
8. Pertahankan ledger minimal selama umur antrean offline. Antrean modul ini tidak memiliki TTL; jika ledger kadaluwarsa lebih cepat, unique client_uuid atau endpoint rekonsiliasi harus tetap mencegah duplikasi.
9. Validasi MIME nyata, ukuran, jumlah foto, field form, kepemilikan desa, dan koordinat di server. Pemeriksaan client bukan batas keamanan.

Belum ada endpoint/controller/ledger Laravel yang dibuat oleh modul frontend ini; jangan mengklaim jaminan end-to-end sebelum sisi backend diselesaikan dan diuji.

## Background Sync dan app shell

Implementasi yang tersedia memilih custom hook sebagai baseline. Ia memproses antrean saat halaman terbuka/aktif, pulih saat online atau tab terlihat, dan menggunakan timer maksimal 30 detik untuk pemeriksaan ulang. Saat tab ditutup atau OS menghentikan PWA, hook tidak menjamin sinkronisasi.

Untuk Background Sync opsional, bundle sync-engine.ts ke service worker melalui pipeline Vite; event sync harus memakai event.waitUntil(processOutbox(...)). Ambil owner/session dari mekanisme auth yang aman, jangan menyimpan token pada outbox atau memasang user ID tetap dalam bundle. Karena service worker tidak memiliki akses auth store React, adapter autentikasinya perlu dirancang tersendiri. IndexedDB dan lease engine dapat dipakai bersama oleh worker serta hook. Dukung foreground fallback untuk browser tanpa Background Sync.

Belum ada service worker/cache app shell atau manifest PWA yang dibuat. Agar benar-benar bisa dibuka saat blank-spot, cache app shell/aset berversi melalui service worker, siapkan navigasi offline, dan jangan cache POST laporan dengan strategi generik. Instalasi pertama dan pemuatan aset awal tetap membutuhkan koneksi. Jangan force activate/reload service worker di tengah penyimpanan draft.

## Keamanan, kuota, dan pengujian

- IndexedDB bukan penyimpanan terenkripsi aplikasi. Minimalkan data sensitif dan lindungi dari XSS; jangan log token/payload sensitif.
- Perangkat dapat dipakai beberapa akun: hanya proses row owner yang sama dengan sesi aktif. Logout tidak otomatis menghapus draft; sediakan kebijakan eksplisit agar data tidak hilang atau bocor ke akun lain.
- Perubahan sesi setelah request terautentikasi dimulai tidak dapat menarik kembali side effect server. Backend wajib menentukan user dari autentikasi request, bukan mempercayai owner_id client.
- Tangani QuotaExceededError dan kegagalan IndexedDB di UI. Jangan menghapus draft/foto yang belum synced untuk menyediakan ruang secara diam-diam.
- navigator.storage.persist() merupakan permintaan; izin atau browser storage tidak menjamin cadangan. Tampilkan jumlah pending dan sediakan ekspor jika kebijakan lapangan membutuhkannya.
- Pengujian wajib: kamera portrait dengan EXIF, PNG transparan, foto 40 MB, WebP tidak didukung, target ukuran, orientasi, dan memori perangkat rendah.
- Uji mode offline, online palsu/captive portal, timeout setelah commit server, 500, 429 dengan Retry-After, 401/419, 422, 202 pending, dan kuota habis.
- Uji double-click submit, dua tab, refresh di tengah request, crash sebelum/selepas commit, expiry lease, logout/ganti akun, retry key sama, serta konflik hash backend.
- Typecheck dan build belum dijalankan: tsc global tidak tersedia dan apps/web belum memiliki scaffold/dependency frontend. Selesaikan setup workspace, lalu jalankan typecheck/build serta uji integrasi sebelum memakai di produksi.
