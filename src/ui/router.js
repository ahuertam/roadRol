// Hash router minimal. Rutas con ':param' capturan segmentos dinámicos.
// Handlers reciben (params, container) y pueden:
//   - devolver un string de HTML (se inyecta en container), o
//   - escribir directamente en container y no devolver nada.
// Tras el render, auto-enlaza cualquier [data-nav] del DOM resultante.

const routes = {}

export function mount(routeMap) {
  Object.assign(routes, routeMap)
  window.addEventListener('hashchange', render)
  render()
}

async function render() {
  const path = location.hash.slice(1) || '/'
  const { handler, params } = match(path)
  const app = document.getElementById('app')
  app.innerHTML = ''
  try {
    const result = await handler(params, app)
    if (typeof result === 'string') app.innerHTML = result
  } catch (err) {
    console.error('Router handler falló:', err)
    app.innerHTML = `<main class="screen placeholder">Error: ${escapeHtml(err.message)}</main>`
  }

  // Auto-bind data-nav
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}
