// Importar / Exportar JSON.
// ponytail: validación por schema llega en fase 2 (sistemas).
// Aquí solo verificamos shape básico para no guardar basura.

import { SCHEMA_VERSION } from './models.js'

/**
 * Construye un Blob JSON a partir de una entidad y dispara descarga.
 * @param {object} entity
 * @param {string} filename
 */
export function downloadJSON(entity, filename) {
  const payload = { schema: SCHEMA_VERSION, entity }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Lee un File y devuelve { schema, entity } parseado.
 * @param {File} file
 */
export async function readJSONFile(file) {
  const text = await file.text()
  return JSON.parse(text)
}

/**
 * Validación de shape mínimo. Devuelve string con error o null si OK.
 * @param {object} obj
 * @param {'character'|'game'} kind
 */
export function validateShape(obj, kind) {
  if (!obj || typeof obj !== 'object') return 'JSON vacío o inválido'
  if (kind === 'character') {
    if (typeof obj.name !== 'string' || !obj.name.trim()) return 'Falta name'
    if (typeof obj.system !== 'string') return 'Falta system'
    if (typeof obj.stats !== 'object' || obj.stats === null) return 'Falta stats'
  } else if (kind === 'game') {
    if (typeof obj.name !== 'string') return 'Falta name'
    if (typeof obj.system !== 'string') return 'Falta system'
    if (!Array.isArray(obj.characters)) return 'characters debe ser array'
    if (!Array.isArray(obj.encounters)) return 'encounters debe ser array'
  } else {
    return 'Tipo desconocido: ' + kind
  }
  return null
}

/** Sugiere nombre de archivo para descarga según la entidad. */
export function defaultFilename(entity) {
  const safe = (entity.name || 'sin-nombre')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const stamp = new Date().toISOString().slice(0, 10)
  return `${safe}-${stamp}.json`
}
