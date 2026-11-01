// Generador de UUID v4.
//
// ponytail: crypto.randomUUID() SOLO existe en contextos seguros (HTTPS o
// localhost). Sobre http://192.168.x.x:5173 — que es como se prueba en el
// móvil — no está y la app entera se rompe al no poder generar IDs.
// crypto.getRandomValues() sí está disponible en contextos inseguros, así que
// lo usamos de fallback con el mismo formato v4.

export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return uuidV4Fallback()
}

function uuidV4Fallback() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40   // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80   // variante 10xx
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
