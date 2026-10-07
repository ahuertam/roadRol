// ponytail: escape HTML para evitar XSS al interpolar strings de usuario en HTML.
// SIEMPRE usarlo al meter datos no controlados (nombres, notas, settings importadas...)
// en atributos o texto. Es seguro pasarle números (no tienen chars especiales).

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}
