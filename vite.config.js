import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // ponytail: icons vacíos por ahora — se añaden en fase 10
      manifest: {
        name: 'RoadRol — Director de partidas',
        short_name: 'RoadRol',
        description: 'Director de partidas de rol en el móvil',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'es',
        categories: ['games', 'entertainment'],
        // ponytail: usamos SVG porque Chrome/Firefox/Edge lo soportan y Vite
        // lo copia a dist sin procesado extra. iOS Safari necesita PNG aparte.
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        // ponytail: por defecto workbox solo precachea js/css/html. Ampliamos a
        // json (packs de /samples/) y jpg/svg (librería de imágenes en
        // /images/library/) para que todo funcione offline tras la 1ª carga.
        globPatterns: ['**/*.{js,css,html,json,jpg,svg}'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024
      },
      devOptions: { enabled: true }
    })
  ],
  server: { host: true }
})
