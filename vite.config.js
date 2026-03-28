import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'SetTempo',
        short_name: 'SetTempo',
        description: 'Performance management tool for musicians and bands',
        theme_color: '#131314',
        background_color: '#131314',
        display: 'standalone',
        icons: [
          { src: 'icons/pwa-64x64.png',            sizes: '64x64',   type: 'image/png' },
          { src: 'icons/pwa-192x192.png',           sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png',           sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
})
