import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg'],
    manifest: {
      name: 'JAGAPADI Kabupaten Jember 3509', short_name: 'JAGAPADI',
      description: 'Pelaporan lapangan pertanian Kabupaten Jember',
      theme_color: '#15803d', background_color: '#f8fafc', display: 'standalone',
      start_url: '/', scope: '/', lang: 'id',
      icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: { navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api(?:\/|$)/], globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] },
  })],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } } },
});
