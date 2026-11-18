// Sistema: La Llamada de Cthulhu (7ª edición)
// Stats runtime: HP, SAN, 8 características (FUE, CON, TAM, DES, APA, INT, POD, EDU).
// Habilidades específicas (Buscar, Ocultarse, Persuasión, etc.): NO se gestionan aquí.
// ponytail: el master tira dados libres durante el encuentro, no almacenamos skills.

const schema = {
  fields: [
    { key: 'hp',     type: 'number', label: 'HP',     min: 0,         group: 'vital' },
    { key: 'maxHp',  type: 'number', label: 'HP Máx', min: 1,         group: 'vital' },
    { key: 'san',    type: 'number', label: 'SAN',    min: 0, max: 99, group: 'vital' },
    { key: 'maxSan', type: 'number', label: 'SAN Máx',min: 1, max: 99, default: 50, group: 'vital' },
    { key: 'str',    type: 'number', label: 'FUE',    min: 1, max: 99, default: 50, group: 'ability' },
    { key: 'con',    type: 'number', label: 'CON',    min: 1, max: 99, default: 50, group: 'ability' },
    { key: 'siz',    type: 'number', label: 'TAM',    min: 1, max: 99, default: 50, group: 'ability' },
    { key: 'dex',    type: 'number', label: 'DES',    min: 1, max: 99, default: 50, group: 'ability' },
    { key: 'app',    type: 'number', label: 'APA',    min: 1, max: 99, default: 50, group: 'ability' },
    { key: 'int',    type: 'number', label: 'INT',    min: 1, max: 99, default: 50, group: 'ability' },
    { key: 'pow',    type: 'number', label: 'POD',    min: 1, max: 99, default: 50, group: 'ability' },
    { key: 'edu',    type: 'number', label: 'EDU',    min: 1, max: 99, default: 50, group: 'ability' }
  ]
}

function defaultStats() {
  return {
    hp: 10, maxHp: 10,
    san: 50, maxSan: 50,
    str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 50, edu: 50
  }
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
  if (json.stats.san != null && json.stats.maxSan != null && json.stats.san > json.stats.maxSan) {
    errors.push('SAN no puede superar SAN Máx')
  }
  // ponytail: regla opcional del manual — SAN Máx típica = 99 - POD, pero la hacemos warning suave:
  // no la imponemos para permitir investigadores con POD bajo o alto a propósito.
  return errors.length ? { ok: false, errors } : { ok: true }
}

export default {
  id: 'cthulhu',
  name: 'La Llamada de Cthulhu 7e',
  characterSchema: schema,
  defaultStats,
  validateCharacter
}
