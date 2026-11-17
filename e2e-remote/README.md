# E2E Remote Browser (Playwright) — JAGAPADI v3

Smoke test yang menghubungkan Playwright ke **browser remote** (bukan browser lokal yang diluncurkan otomatis).

## Prasyarat
- Node.js >= 22 (sesuai monorepo).
- Aplikasi dapat diakses dari sisi browser remote:
  - **Web**: `PW_BASE_URL` (default `http://127.0.0.1:5173`, dev Vite) atau URL deploy/Laragon.
  - **API**: untuk alur login, API Laravel harus hidup + DB/Redis sesuai `.env` (Sanctum session, `/sanctum/csrf-cookie`, `/api/auth/login`).
- Endpoint browser remote tersedia.

## Mode koneksi
| Env | Kapan dipakai |
|---|---|
| `PW_REMOTE_ENDPOINT=ws://host:port/` | Playwright Browser Server (`chromium.connect`) |
| `PW_REMOTE_ENDPOINT=http://host:9222` + `PW_REMOTE_CDP=1` | Chrome DevTools Protocol (`connectOverCDP`) |
| `PW_REMOTE_ENDPOINT=ws://host:9222/devtools/browser/...` | CDP WebSocket (otomatis terdeteksi) |

## Menjalankan
```powershell
$env:PW_REMOTE_ENDPOINT="ws://<remote-host>:<port>/"
$env:PW_BASE_URL="http://127.0.0.1:5173"   # atau URL yang bisa dijangkau browser remote
# opsional: $env:PW_SKIP_LOGIN="1" jika API tidak tersedia
npx -y playwright@1.52.0 node e2e-remote/smoke-remote.mjs
```

## Akun demo (jika DB ter-seed)
`petugas@jagapadi.test` / `password` (lihat `apps/api/database/seeders/UserSeeder.php`).

## Catatan
- Jika `PW_BASE_URL` menunjuk ke `127.0.0.1` tetapi browser berjalan di mesin *remote*, `127.0.0.1` mengarah ke mesin remote — ganti dengan IP/hostname yang bisa dijangkau dari remote.
- `connectOverCDP` memakai context yang sudah ada bila tersedia; perilaku cookie/session mengikuti browser remote.
