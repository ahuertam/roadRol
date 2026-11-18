// Sistema: D&D 5e
// Stats runtime que cambian en partida: HP, CA, scores de habilidad.
// Habilidades, poderes, inventario: NO se gestionan aquí (lo lleva el jugador en su ficha).

const schema = {
  fields: [
    { key: 'hp',    type: 'number', label: 'HP',     min: 0, group: 'vital' },
    { key: 'maxHp', type: 'number', label: 'HP Máx', min: 1, group: 'vital' },
    { key: 'ac',    type: 'number', label: 'CA',     min: 0, group: 'vital' },
    { key: 'str',   type: 'number', label: 'FUE',    min: 1, max: 30, default: 10, group: 'ability' },
    { key: 'dex',   type: 'number', label: 'DES',    min: 1, max: 30, default: 10, group: 'ability' },
    { key: 'con',   type: 'number', label: 'CON',    min: 1, max: 30, default: 10, group: 'ability' },
    { key: 'int',   type: 'number', label: 'INT',    min: 1, max: 30, default: 10, group: 'ability' },
    { key: 'wis',   type: 'number', label: 'SAB',    min: 1, max: 30, default: 10, group: 'ability' },
    { key: 'cha',   type: 'number', label: 'CAR',    min: 1, max: 30, default: 10, group: 'ability' }
  ]
}

function defaultStats() {
  return { hp: 10, maxHp: 10, ac: 10, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
}

function validateCharacter(json) {
  const errors = []
  if (!json || typeof json !== 'object') return { ok: false, errors: ['Personaje inválido'] }
  if (!json.name || !String(json.name).trim()) errors.push('Falta nombre')
  if (!json.stats || typeof json.stats !== 'object') {
    return { ok: false, errors: ['Faltan stats'] }
  }
  for (const field of schema.fields) {
    const v = json.stats[field.key]
    if (typeof v !== 'number' || Number.isNaN(v)) {
      errors.push(`${field.label}: debe ser número`)
      continue
    }
    if (field.min != null && v < field.min) errors.push(`${field.label}: mínimo ${field.min}`)
    if (field.max != null && v > field.max) errors.push(`${field.label}: máximo ${field.max}`)
  }
  if (json.stats.hp != null && json.stats.maxHp != null && json.stats.hp > json.stats.maxHp) {
    errors.push('HP no puede superar HP Máx')
  }
  return errors.length ? { ok: false, errors } : { ok: true }
}

export default {
  id: 'dnd5e',
  name: 'D&D 5e',
  characterSchema: schema,
  defaultStats,
  validateCharacter
}
