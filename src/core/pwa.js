// PWA helpers: install prompt + service worker update notification.
// ponytail: un solo módulo para todo lo PWA. Expone init() que wirea los
// listeners del navegador, y showInstall/showUpdate que la UI llama para pintar
// los banners. El estado se guarda en closures del módulo.

let installPromptEvent = null
let swUpdateWaiting = null
let swRegistration = null

export function initPWA() {
  // Install prompt — Chrome/Edge/Android disparan este evento cuando la PWA es instalable
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPromptEvent = e
    notifyInstallChange()
  })

  // El user instaló (o rechazó) → limpiamos
  window.addEventListener('appinstalled', () => {
    installPromptEvent = null
    notifyInstallChange()
  })

  // SW update — vite-plugin-pwa con autoUpdate emite 'swUpdated' (lo escuchamos abajo)
  // Pero también podemos verificar manualmente al cargar.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      swRegistration = reg
      if (reg.waiting) {
        swUpdateWaiting = reg.waiting
        notifyUpdateChange()
      }
      reg.addEventListener('updatefound', () => {
        const newSw = reg.installing
        if (!newSw) return
        newSw.addEventListener('statechange', () => {
          if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
            swUpdateWaiting = reg.waiting || newSw
            notifyUpdateChange()
          }
        })
      })
    })
  }
}

// ---- API pública ----

export function canInstall() { return !!installPromptEvent }
export function canUpdate() { return !!swUpdateWaiting }

export async function promptInstall() {
  if (!installPromptEvent) return { outcome: 'unavailable' }
  const e = installPromptEvent
  installPromptEvent = null
  notifyInstallChange()
  e.prompt()
  const choice = await e.userChoice
  return { outcome: choice.outcome }
}

export async function applyUpdate() {
  if (!swUpdateWaiting) return
  swUpdateWaiting.postMessage({ type: 'SKIP_WAITING' })
  // El nuevo SW se activa y 'controllerchange' recarga la página (lo gestiona vite-plugin-pwa)
}

// ---- Internals: notify la UI ----

function notifyInstallChange() {
  window.dispatchEvent(new CustomEvent('pwa-install-change'))
}

function notifyUpdateChange() {
  window.dispatchEvent(new CustomEvent('pwa-update-change'))
}
