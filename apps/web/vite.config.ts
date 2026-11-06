import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg'],
    manifest: {
      name: 'JAGAPADI Kabupaten Jember 3509', short_name: 'JAGAPADI',
      theme_color: '#133D2B', background_color: '#F2F7F0', display: 'standalone',
      start_url: '/', scope: '/', lang: 'id',
      description: 'Sistem pelaporan dan analitik pertanian Kabupaten Jember (mitra statistik BPS dan Dinas TPHP)',
      icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: { navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/(api|sanctum)(\/|$)/], globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] },
  })],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: {
    '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    '/sanctum': { target: 'http://127.0.0.1:8000', changeOrigin: true },
  } },
});
