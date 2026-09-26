// Pantalla genérica para rutas todavía sin implementar (fase 0).
// ponytail: una función sirve para todas; cuando cada pantalla tenga contenido se reemplaza.

export function renderPlaceholder(label, back = '/') {
  return `
    <main class="screen placeholder">
      <p>${label} — próximamente</p>
      <button class="btn btn--ghost placeholder__back" data-nav="${back}">← Volver</button>
    </main>
  `
}
