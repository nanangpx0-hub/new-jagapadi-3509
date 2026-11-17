/**
 * Playwright smoke test for JAGAPADI v3 using a REMOTE browser.
 *
 * Connects via Playwright's browser server (ws://.../ or wss://...) using
 * `chromium.connect()`, or via Chrome DevTools Protocol using
 * `chromium.connectOverCDP()` when PW_REMOTE_CDP=1 or endpoint looks like CDP.
 *
 * Env:
 *   PW_REMOTE_ENDPOINT  - required. ws(s):// endpoint, or http(s):// CDP endpoint
 *   PW_BASE_URL         - app URL to test (default: http://127.0.0.1:5173)
 *   PW_REMOTE_CDP       - "1" to force connectOverCDP
 *   PW_LOGIN_EMAIL      - demo login (default: petugas@jagapadi.test)
 *   PW_LOGIN_PASSWORD   - demo password (default: password)
 *   PW_SKIP_LOGIN       - "1" to skip authenticated flow
 *   PW_HEADFUL          - ignored for remote; for info only
 *
 * Run:
 *   npx -y playwright@1.52.0 node e2e-remote/smoke-remote.mjs
 *   (or: node e2e-remote/smoke-remote.mjs  if playwright is resolvable)
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const endpoint = process.env.PW_REMOTE_ENDPOINT;
const baseURL = (process.env.PW_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const forceCdp = process.env.PW_REMOTE_CDP === '1';
const email = process.env.PW_LOGIN_EMAIL || 'petugas@jagapadi.test';
const password = process.env.PW_LOGIN_PASSWORD || 'password';
const skipLogin = process.env.PW_SKIP_LOGIN === '1';

function log(step, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${step}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  if (!endpoint) {
    console.error('Missing PW_REMOTE_ENDPOINT (ws(s):// Playwright server or CDP endpoint).');
    console.error('Example (Playwright server): PW_REMOTE_ENDPOINT=ws://remote:3000/');
    console.error('Example (CDP):              PW_REMOTE_ENDPOINT=http://remote:9222 PW_REMOTE_CDP=1');
    process.exit(2);
  }

  const isCdp = forceCdp || /^https?:\/\//i.test(endpoint) || /\/devtools\//i.test(endpoint);
  console.log(`Connecting to remote browser (${isCdp ? 'CDP' : 'Playwright ws'}) at ${endpoint}`);
  console.log(`Base URL: ${baseURL}`);

  let browser;
  try {
    browser = isCdp
      ? await chromium.connectOverCDP(endpoint)
      : await chromium.connect(endpoint);
    log('Remote browser connection', true, browser.version ? `version ${browser.version()}` : 'connected');
  } catch (err) {
    log('Remote browser connection', false, err instanceof Error ? err.message : String(err));
    throw err;
  }

  const context = isCdp
    ? (browser.contexts()[0] ?? await browser.newContext({ ignoreHTTPSErrors: true }))
    : await browser.newContext({ ignoreHTTPSErrors: true, baseURL });
  const page = context.pages()[0] ?? await context.newPage();

  const results = { passed: 0, failed: 0 };
  const check = (name, cond, detail) => {
    log(name, !!cond, detail);
    cond ? results.passed++ : results.failed++;
  };

  try {
    // 1) App reachable + redirects/loads
    const resp = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => ({ error: e }));
    check('Open base URL', resp && !resp.error && (resp.status?.() ? resp.status() < 500 : true),
      resp?.error ? resp.error.message : `HTTP ${resp?.status?.() ?? '?'} ${page.url()}`);

    // 2) Login page (JAGAPADI shows "Masuk" and demo accounts)
    await page.waitForTimeout(1500);
    const url = page.url();
    const onLogin = /\/login/i.test(url);
    const hasMasuk = await page.getByRole('heading', { name: /masuk/i }).first().isVisible().catch(() => false)
      || await page.getByText('Masuk', { exact: false }).first().isVisible().catch(() => false);
    check('Login page or app shell visible', onLogin || hasMasuk || /jagapadi/i.test(await page.title().catch(() => '')),
      `url=${url}`);

    if (onLogin) {
      check('Login form: email field', await page.locator('#email, input[type="email"], input[name="email"]').first().isVisible().catch(() => false));
      check('Login form: password field', await page.locator('#password, input[type="password"]').first().isVisible().catch(() => false));
      check('Login form: demo accounts hint', await page.getByText(/akun demo|password: password/i).first().isVisible().catch(() => false));
    }

    // 3) Authenticated smoke (if on login and not skipped)
    if (!skipLogin && onLogin) {
      await page.locator('#email, input[type="email"]').first().fill(email).catch(() => {});
      await page.locator('#password, input[type="password"]').first().fill(password).catch(() => {});
      await page.getByRole('button', { name: /^masuk$/i }).first().click().catch(() =>
        page.locator('button[type="submit"]').first().click().catch(() => {}));

      await page.waitForURL((u) => !/\/login/i.test(u.toString()), { timeout: 15000 }).catch(() => {});
      const loggedIn = !/\/login/i.test(page.url());
      check('Login with demo account', loggedIn, `email=${email} url=${page.url()}`);

      if (loggedIn) {
        // Navigate a few key routes
        for (const [name, path] of [['Reports', '/reports'], ['Peta', '/peta'], ['Status', '/status'], ['Akun', '/akun']]) {
          await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
          await page.waitForTimeout(800);
          const ok = !/\/login/i.test(page.url()) && (await page.locator('body').innerText().catch(() => '')).length > 20;
          check(`Navigate ${name} (${path})`, ok, page.url());
        }
      } else {
        const errText = await page.locator('[role="alert"]').first().innerText().catch(() => '');
        console.log(`  (login did not redirect; alert="${errText}") — API/backend may be unavailable`);
      }
    } else if (skipLogin) {
      console.log('[SKIP] Login flow (PW_SKIP_LOGIN=1)');
    }

    // 4) Screenshot artifact path (remote fs may differ; best-effort)
    const shotPath = fileURLToPath(new URL('./smoke-remote.png', import.meta.url));
    await page.screenshot({ path: shotPath, fullPage: true }).catch((e) =>
      console.log(`[INFO] Screenshot skipped: ${e.message}`));
    console.log(`Screenshot (best-effort): ${shotPath}`);
  } finally {
    await context.close().catch(() => {});
    // Do not close browser if it was pre-existing CDP context; disconnect is enough.
    await browser.close().catch(() => browser.disconnect?.().catch?.(() => {}));
  }

  console.log(`\nSummary: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
