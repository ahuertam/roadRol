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
        icons: []
      },
      devOptions: { enabled: true }
    })
  ],
  server: { host: true }
})
