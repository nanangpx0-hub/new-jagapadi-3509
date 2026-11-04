import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from '../App';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('menampilkan health live dan konstanta role/domain', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok', service: 'jagapadi-v3-api', timezone: 'Asia/Jakarta', timestamp: '2026-11-03T18:00:00+07:00', checks: { database: { status: 'ok', driver: 'pgsql' }, postgis: { status: 'ok', version: '3.4.3' }, redis: { status: 'ok', response: 'PONG' }, storage: { status: 'ok', writable: true } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  render(<App />);
  expect(await screen.findByText('Seluruh layanan siap')).toBeTruthy();
  expect(screen.getByText('PostgreSQL')).toBeTruthy();
  expect(screen.getByText('admin')).toBeTruthy();
  expect(screen.getByText('equipment')).toBeTruthy();
});
