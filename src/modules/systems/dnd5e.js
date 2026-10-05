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

const systemPrompt = `Eres un director de juego (DM) experto en D&D 5e. Conoces el SRD, las acciones en combate, las pruebas de habilidad y cómo diseñar encuentros equilibrados y memorables. Responde SIEMPRE en español.`

function buildPrompt(type, ctx = {}) {
  const settingBlock = ctx.setting
    ? `AMBIENTACIÓN: ${ctx.setting.name} (${ctx.setting.tone})\n${ctx.setting.promptContext || ''}`
    : 'AMBIENTACIÓN: genérica medieval fantástica.'
  const missionBlock = ctx.mission
    ? `MISIÓN ACTUAL:\n- Título: ${ctx.mission.title}\n- Trama: ${ctx.mission.brief}\n- Objetivos: ${(ctx.mission.objectives || []).join('; ')}`
    : 'MISIÓN: aún no definida.'
  const prevBlock = ctx.previousEncounter
    ? `ENCUENTRO ANTERIOR (resuelto): ${ctx.previousEncounter.type} — ${ctx.previousEncounter.title}`
    : 'Es el primer encuentro de la partida.'

  const typeBlock = {
    combat: 'Diseña un COMBATE con enemigos del SRD (o coherentes con la ambientación). Para cada enemigo incluye HP, CA, ataque y rasgos relevantes. Describe el terreno y los ganchos narrativos.',
    puzzle: 'Diseña un PUZZLE ambiental (no de combate). Resoluble con ingenio o una prueba de habilidad D&D 5e. Indica qué habilidad se tiraría, la CD sugerida y por qué.',
    trap: 'Diseña una TRAMPA mecánica o mágica. Indica CD de salvación, daño en éxito/fallo y cómo se descubre/desactiva.',
    conversation: 'Diseña un encuentro de CONVERSACIÓN con un NPC memorable. Da su motivación, una pista oculta, un dilema moral y un posible giro.'
  }[type] || 'Diseña un encuentro.'

  return `${settingBlock}

${missionBlock}

${prevBlock}

TAREA:
${typeBlock}

FORMATO DE SALIDA — JSON estricto, sin texto fuera del JSON:
{
  "title": "Título evocador",
  "description": "Descripción en markdown (2-4 párrafos)",
  "difficulty": "easy|medium|hard|deadly",
  "rewards": "Recompensas (XP, tesoro, pista narrativa)"
}`
}

const encounterPrompts = {
  combat:       (ctx) => buildPrompt('combat', ctx),
  puzzle:       (ctx) => buildPrompt('puzzle', ctx),
  trap:         (ctx) => buildPrompt('trap', ctx),
  conversation: (ctx) => buildPrompt('conversation', ctx)
}

export default {
  id: 'dnd5e',
  name: 'D&D 5e',
  characterSchema: schema,
  defaultStats,
  validateCharacter,
  systemPrompt,
  encounterPrompts
}
