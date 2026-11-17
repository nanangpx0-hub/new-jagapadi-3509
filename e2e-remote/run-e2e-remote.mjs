/**
 * Orchestrated Playwright REMOTE browser E2E:
 *  - serves apps/web/dist (+ proxy /api,/sanctum -> 127.0.0.1:8000) on 4173
 *  - launches a Playwright "remote" browser server (wsEndpoint)
 *  - runs smoke-remote.mjs connecting to that remote browser
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');
const dist = path.join(repo, 'apps', 'web', 'dist');
const PORT = Number(process.env.E2E_PORT || 4173);
const API_TARGET = { host: '127.0.0.1', port: 8000 };
const skipLogin = process.env.PW_SKIP_LOGIN ?? '1'; // default skip: API/DB may be down

const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.ico':'image/x-icon' };

function proxy(req, res) {
  const opts = { host: API_TARGET.host, port: API_TARGET.port, method: req.method, path: req.url, headers: { ...req.headers, host: `127.0.0.1:${API_TARGET.port}` } };
  const pr = httpRequest(opts, (prRes) => { res.writeHead(prRes.statusCode || 502, prRes.headers); prRes.pipe(res); });
  pr.on('error', (e) => { res.writeHead(502, {'content-type':'application/json'}); res.end(JSON.stringify({ error:'proxy_error', message:e.message })); });
  req.pipe(pr);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let p = path.join(dist, decodeURIComponent(url.pathname));
  try {
    const st = await stat(p);
    if (st.isDirectory()) p = path.join(p, 'index.html');
  } catch {
    // SPA fallback (but not for /api,/sanctum)
    p = path.join(dist, 'index.html');
  }
  try {
    const ext = path.extname(p).toLowerCase();
    res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream' });
    createReadStream(p).pipe(res);
  } catch (e) {
    res.writeHead(404); res.end('not found');
  }
}

function runSmoke(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'smoke-remote.mjs')], {
      cwd: __dirname, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; process.stdout.write(d); });
    child.stderr.on('data', d => { err += d; process.stderr.write(d); });
    child.on('close', (code) => resolve({ code: code ?? 1, out, err }));
  });
}

async function main() {
  console.log('== Playwright REMOTE browser E2E (orchestrated) ==');
  console.log(`Dist: ${dist}`);
  console.log(`Server: http://127.0.0.1:${PORT}  (proxy /api,/sanctum -> ${API_TARGET.host}:${API_TARGET.port})`);

  const server = createServer((req, res) => {
    if ((req.url || '').startsWith('/api') || (req.url || '').startsWith('/sanctum')) return proxy(req, res);
    return serveStatic(req, res);
  });
  await new Promise((resolve, reject) => server.listen(PORT, '127.0.0.1', resolve).on('error', reject));
  console.log('[OK] Static/proxy server listening');

  let browserServer;
  try {
    const exe = chromium.executablePath();
    const headlessShell = exe.replace(/\\chrome-win\\chrome\.exe$/i, '') + '\\..\\chromium_headless_shell-1169\\chrome-win\\headless_shell.exe';
    browserServer = await chromium.launchServer({ headless: true, host: '127.0.0.1', executablePath: headlessShell });
  } catch (e) {
    console.error('[FAIL] Could not launch Playwright remote browser server (headless shell).', e instanceof Error ? e.message : e);
    try {
      browserServer = await chromium.launchServer({ host: '127.0.0.1', args: ['--headless=new','--disable-gpu','--no-sandbox'] });
      console.log('[OK] Fallback: launched via chrome with --headless=new');
    } catch (e2) {
      console.error('[FAIL] Fallback also failed.', e2 instanceof Error ? e2.message : e2);
      console.error('Hint: run `npx playwright install chromium` in e2e-remote if browsers are missing for this Playwright version.');
      server.close();
      process.exit(2);
    }
  }
  const wsEndpoint = browserServer.wsEndpoint();
  console.log(`[OK] Remote browser server (Playwright) wsEndpoint=${wsEndpoint}`);

  let result;
  try {
    result = await runSmoke({
      PW_REMOTE_ENDPOINT: wsEndpoint,
      PW_BASE_URL: `http://127.0.0.1:${PORT}`,
      PW_SKIP_LOGIN: skipLogin,
      PW_REMOTE_CDP: '0',
    });
  } finally {
    await browserServer.close().catch(() => {});
    server.close();
  }

  console.log(`\n== E2E result: exit ${result.code} ==`);
  process.exit(result.code);
}

main().catch((e) => { console.error('Fatal orchestrator:', e); process.exit(1); });
