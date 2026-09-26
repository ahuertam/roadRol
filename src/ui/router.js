// Hash router minimal. Rutas con ':param' capturan segmentos dinámicos.
// Tras renderizar, auto-enlaza cualquier [data-nav] del HTML resultante.

const routes = {}

export function mount(routeMap) {
  Object.assign(routes, routeMap)
  window.addEventListener('hashchange', render)
  render()
}

function render() {
  const path = location.hash.slice(1) || '/'
  const { handler, params } = match(path)
  const app = document.getElementById('app')
  app.innerHTML = handler(params)

  // Auto-bind data-nav: cualquier <button data-nav="/x"> navega al hacer click
  app.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => {
      location.hash = el.dataset.nav
    })
  })
}

function match(path) {
  for (const pattern in routes) {
    const params = matchPattern(pattern, path)
    if (params) return { handler: routes[pattern], params }
  }
  return {
    handler: () => `<main class="screen placeholder">404 — ruta no encontrada</main>`,
    params: {}
  }
}

function matchPattern(pattern, path) {
  const pp = pattern.split('/').filter(Boolean)
  const ap = path.split('/').filter(Boolean)
  if (pp.length !== ap.length) return null
  const params = {}
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(ap[i])
    else if (pp[i] !== ap[i]) return null
  }
  return params
}
