// Banners PWA: "Instalar app" + "Nueva versión disponible".
// Se renderizan en #pwa-banners (un div persistente en index.html) y sobreviven
// a la navegación entre pantallas (el router no los borra porque están fuera de #app).

import { canInstall, canUpdate, promptInstall, applyUpdate, initPWA } from '../core/pwa.js'

let dismissed = { install: false, update: false }

function paint() {
  const host = document.getElementById('pwa-banners')
  if (!host) return

  const showInstall = canInstall() && !dismissed.install
  const showUpdate = canUpdate() && !dismissed.update

  host.innerHTML = `
    ${showInstall ? `
      <div class="pwa-banner" data-banner="install" role="status">
        <span class="pwa-banner__text">📲 Instala RoadRol para jugar offline</span>
        <div class="pwa-banner__actions">
          <button type="button" class="btn btn--sm btn--primary" data-action="install">Instalar</button>
          <button type="button" class="btn btn--sm btn--ghost" data-action="dismiss-install">Ahora no</button>
        </div>
      </div>
    ` : ''}
    ${showUpdate ? `
      <div class="pwa-banner pwa-banner--update" data-banner="update" role="status">
        <span class="pwa-banner__text">✨ Nueva versión disponible</span>
        <div class="pwa-banner__actions">
          <button type="button" class="btn btn--sm btn--primary" data-action="update">Actualizar</button>
          <button type="button" class="btn btn--sm btn--ghost" data-action="dismiss-update">Después</button>
        </div>
      </div>
    ` : ''}
  `

  // Wire de los botones
  host.querySelector('[data-action="install"]')?.addEventListener('click', () => promptInstall())
  host.querySelector('[data-action="dismiss-install"]')?.addEventListener('click', () => {
    dismissed.install = true
    paint()
  })
  host.querySelector('[data-action="update"]')?.addEventListener('click', () => applyUpdate())
  host.querySelector('[data-action="dismiss-update"]')?.addEventListener('click', () => {
    dismissed.update = true
    paint()
  })
}

export function initPWABanners() {
  initPWA()
  // Re-pintar cuando el estado cambie
  window.addEventListener('pwa-install-change', paint)
  window.addEventListener('pwa-update-change', paint)
  // Pintar inicial (por si el evento ya disparó antes de montar esto)
  setTimeout(paint, 0)
}
