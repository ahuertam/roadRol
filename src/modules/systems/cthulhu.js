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

const systemPrompt = `Eres un Guardián (Keeper) experto en La Llamada de Cthulhu 7ª edición. Conoces los mitos, la mecánica de cordura, el horror cósmico lento y la inevitabilidad del fracaso humano. Prioriza tensión y atmósfera sobre acción. Responde SIEMPRE en español.`

function buildPrompt(type, ctx = {}) {
  const settingBlock = ctx.setting
    ? `AMBIENTACIÓN: ${ctx.setting.name} (${ctx.setting.tone})\n${ctx.setting.promptContext || ''}`
    : 'AMBIENTACIÓN: genérica horror cósmico.'
  const missionBlock = ctx.mission
    ? `INVESTIGACIÓN ACTUAL:\n- Título: ${ctx.mission.title}\n- Trama: ${ctx.mission.brief}\n- Pistas: ${(ctx.mission.objectives || []).join('; ')}`
    : 'INVESTIGACIÓN: aún no definida.'
  const prevBlock = ctx.previousEncounter
    ? `EVENTO ANTERIOR (resuelto): ${ctx.previousEncounter.type} — ${ctx.previousEncounter.title}`
    : 'Es el primer evento de la partida.'

  const typeBlock = {
    combat: 'Diseña un encuentro de VIOLENCIA FÍSICA. CoC es letal: un arma de fuego a quemarropa puede matar. Incluye al atacante, su arma, daño probable y, sobre todo, una vía de huida o negociación.',
    puzzle: 'Diseña un ENIGMA o una PISTA que requiera tirar habilidades (Buscar, Bibliotecismo, Persuasión, Ocultarse, etc.). Indica la habilidad sugerida y la CD.',
    trap: 'Diseña una TRAMPA física O una trampa mental con pérdida de cordura (indica coste de SAN al activarse y si es visible o no).',
    conversation: 'Diseña un encuentro con un PNJ perturbador, sospechoso o con información parcial. Da su motivación oculta, una pista, el coste potencial (SAN, dinero, tiempo) y un matiz inquietante.'
  }[type] || 'Diseña un evento.'

  return `${settingBlock}

${missionBlock}

${prevBlock}

TAREA:
${typeBlock}

FORMATO DE SALIDA — JSON estricto, sin texto fuera del JSON:
{
  "title": "Título evocador y atmosférico",
  "description": "Descripción en markdown (2-4 párrafos). Tono opresivo, no épico.",
  "difficulty": "easy|medium|hard",
  "sanCost": "Coste de cordura sugerido si lo hay, ej. '0/1d3' (éxito/fallo)",
  "rewards": "Pistas, aliados o conocimiento obtenido"
}`
}

const encounterPrompts = {
  combat:       (ctx) => buildPrompt('combat', ctx),
  puzzle:       (ctx) => buildPrompt('puzzle', ctx),
  trap:         (ctx) => buildPrompt('trap', ctx),
  conversation: (ctx) => buildPrompt('conversation', ctx)
}

export default {
  id: 'cthulhu',
  name: 'La Llamada de Cthulhu 7e',
  characterSchema: schema,
  defaultStats,
  validateCharacter,
  systemPrompt,
  encounterPrompts
}
