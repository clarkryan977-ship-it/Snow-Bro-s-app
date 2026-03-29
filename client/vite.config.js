import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png', 'logo.jpg'],
      manifest: {
        name: "Snow Bro's Lawn Care",
        short_name: "Snow Bro's",
        description: "Professional residential lawn care services — mowing, trimming, aeration, snow removal, and more.",
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
          { src: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['business', 'utilities'],
        shortcuts: [
          {
            name: 'Book a Service',
            short_name: 'Book',
            description: 'Schedule a lawn care service',
            url: '/book',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Pay Now',
            short_name: 'Pay',
            description: 'Pay via Venmo or Zelle',
            url: '/pay',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        // Prevent the service worker NavigationRoute from intercepting /api/*
        // requests (e.g. contract view URLs opened in a new tab) and serving
        // index.html instead of the actual API response.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /^https?:\/\/.*\/uploads\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  build: {
    // Manual chunk splitting for optimal loading
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/react/') && !id.includes('react-router') && !id.includes('react-leaflet') && !id.includes('react-signature')) return 'vendor-react';
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          if (id.includes('node_modules/axios')) return 'vendor-axios';
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) return 'vendor-leaflet';
          if (id.includes('node_modules/react-signature-canvas') || id.includes('node_modules/signature_pad')) return 'vendor-signature';
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs')) return 'vendor-chart';
        }
      }
    },
    // Increase chunk warning limit
    chunkSizeWarningLimit: 300,
    // Enable source maps for debugging (small overhead)
    sourcemap: false,
    // Use default minifier (oxc in Vite 8)
    minify: true,
    // Target modern browsers for smaller output
    target: 'es2020',
    // CSS code splitting
    cssCodeSplit: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
