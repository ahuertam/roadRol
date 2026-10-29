// Sistema de imágenes para RoadRol. Tres capas:
//   1) Librería local: manifest.json con imágenes taggeadas, servidas como
//      archivos estáticos (PWA las cachea, rápidas y offline).
//   2) Fallback dinámico: Pollinations URL con prompt derivado de la entidad.
//   3) Fallback visual: gradiente CSS determinista desde el nombre (siempre funciona).
//
// El flujo: tag-match entity→library. Si no hay match, usa dynamic. Si dynamic
// falla, gradiente. Nunca se ve roto.

const LIBRARY_URL = '/images/library/manifest.json'
const LIBRARY_PATH = '/images/library/'

let libraryPromise = null

async function loadLibrary() {
  if (libraryPromise) return libraryPromise
  libraryPromise = (async () => {
    try {
      const resp = await fetch(LIBRARY_URL)
      if (!resp.ok) return null
      const manifest = await resp.json()
      return manifest
    } catch {
      return null
    }
  })()
  return libraryPromise
}

// ---- Tagging automático de entidades ----

// ponytail: los tags de tipo son el NOMBRE canónico + sinónimos estrechos.
// Nada de términos genéricos como "mystery" aquí — antes estaba en puzzle y
// discovery y matcheaba casi cualquier imagen, mountaining a la elección.
const TYPE_TAGS = {
  combat:       ['combat', 'battle', 'fight'],
  puzzle:       ['puzzle', 'riddle', 'enigma'],
  trap:         ['trap', 'hazard'],
  conversation: ['dialogue', 'negotiation', 'interview'],
  discovery:    ['evidence', 'revelation', 'investigation']
}

const SYSTEM_TAGS = {
  dnd5e:   ['dnd5e', 'fantasy'],
  cthulhu: ['cthulhu', 'horror']
}

const SETTING_TAGS = {
  fantasy: ['fantasy', 'medieval', 'magic'],
  horror:  ['horror', 'lovecraftian', 'eldritch']
}

// Stopwords ES + EN para el tagger de keywords
const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'a', 'al', 'con', 'por', 'para',
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'with', 'for', 'and', 'or', 'is', 'are',
  'y', 'o', 'es', 'son', 'que', 'no', 'más', 'pero', 'sin', 'entre', 'sobre', 'bajo',
  'this', 'that', 'it', 'be', 'from', 'as', 'by', 'was', 'were', 'has', 'have', 'not'
])

// ponytail: puente ES→EN. Los packs están en español pero los tags en inglés;
// sin esto "mansión" nunca matchea con "mansion". Solo las palabras que aparecen
// en los 25 packs actuales — ampliar si los packs cambian.
const SYNONYMS = {
  // lugares
  'bosque': 'forest', 'bosques': 'forest', 'robledo': 'forest', 'selva': 'forest',
  'dungeon': 'dungeon', 'mazmorra': 'dungeon', 'mazmorras': 'dungeon',
  'cripta': 'crypt', 'tumba': 'crypt', 'sepulcro': 'crypt', 'osario': 'crypt',
  'mansion': 'mansion', 'mansión': 'mansion', 'casaron': 'mansion', 'casona': 'mansion',
  'finca': 'mansion', 'villa': 'mansion', 'casa': 'indoor',
  'taberna': 'tavern', 'posada': 'tavern', 'meson': 'tavern', 'bar': 'tavern',
  'biblioteca': 'library', 'archivo': 'library', 'libros': 'books', 'libro': 'books',
  'hospital': 'hospital', 'sanatorio': 'sanatorio', 'clínica': 'hospital', 'clinica': 'hospital',
  'manicomio': 'asylum', 'enfermería': 'asylum', 'enfermeria': 'asylum',
  'puerto': 'port', 'muelle': 'port', 'faro': 'port',
  'torre': 'tower', 'castillo': 'throne', 'trono': 'throne', 'reino': 'king', 'rey': 'king',
  'montaña': 'mountain', 'montana': 'mountain', 'montañas': 'mountain', 'cumbre': 'mountain',
  'aldea': 'village', 'pueblo': 'village', 'village': 'village',
  'barco': 'ship', 'navío': 'ship', 'navio': 'ship', 'galeón': 'ship', 'galeon': 'ship',
  'pirata': 'pirate', 'mar': 'sea', 'océano': 'sea', 'ocaso': 'sea',
  'ruinas': 'ruins', 'ruina': 'ruins', 'templo': 'ruins', 'catedral': 'ruins',
  'cueva': 'cave', 'caverna': 'cave', 'cripta2': 'crypt',
  'neblina': 'fog', 'niebla': 'fog', 'bruma': 'fog', 'neblinoso': 'fog',
  'noche': 'night', 'nocturno': 'night', 'medianoche': 'night', 'oscuridad': 'dark',
  'oscuridad2': 'dark', 'sombrío': 'dark', 'sombrío2': 'dark',
  'lluvia': 'storm', 'tormenta': 'storm', 'vendaval': 'storm',
  'cementerio': 'graveyard', 'tumba2': 'graveyard', 'sepultura': 'graveyard',
  'metro': 'subway', 'túnel': 'subway', 'tunel': 'subway', 'andén': 'subway',
  'tienda': 'indoor', 'cocina': 'indoor', 'despacho': 'indoor', 'oficina': 'office',
  'sótano': 'indoor', 'sotano': 'indoor', 'cueva2': 'cave',

  // seres / criaturas
  'dragón': 'dragon', 'dragon': 'dragon', 'serpiente': 'snake',
  'goblin': 'goblin', 'goblins': 'goblin', 'ogro': 'orc', 'orcos': 'orc', 'troll': 'orc',
  'esqueleto': 'skeleton', 'esqueletos': 'skeleton', 'no-muerto': 'undead',
  'muertos': 'undead', 'zombi': 'undead', 'vampiro': 'undead', 'vampiros': 'undead',
  'hechicero': 'wizard', 'hechicera': 'wizard', 'mago': 'wizard', 'maga': 'wizard',
  'bruja': 'witch', 'brujo': 'witch', 'hechicería': 'magic', 'hechiceria': 'magic',
  'mágico': 'magic', 'magico': 'magic', 'magia': 'magic', 'runa': 'runes',
  'runas': 'runes', 'hechizo': 'magic', 'conjuro': 'magic', 'ritual': 'ritual',
  'culto': 'cult', 'cultista': 'cult', 'cultistas': 'cult', 'secta': 'cult',
  'demonio': 'eldritch', 'demonios': 'eldritch', 'tentáculo': 'tentacle',
  'tentaculos': 'tentacle', 'monstruo': 'creature', 'criatura': 'creature',
  'criaturas': 'creature', 'espectro': 'ghost', 'fantasma': 'ghost', 'alma': 'soul',
  'almas': 'soul', 'sombra': 'shadow', 'sombras': 'shadow', 'oscuridad3': 'shadow',
  'elfo': 'elf', 'elfa': 'elf', 'enano': 'dwarf', 'enana': 'dwarf',
  'hombre': 'man', 'mujer': 'woman', 'niño': 'boy', 'niña': 'girl',

  // objetos / conceptos
  'libro': 'books', 'manuscrito': 'book', 'códice': 'book', 'codice': 'book',
  'diario': 'diary', 'carta': 'letter', 'letra': 'letter', 'nota': 'letter',
  'mapa': 'map', 'llave': 'key', 'llaves': 'key', 'caja': 'chest', 'cofre': 'chest',
  'tesoro': 'treasure', 'oro': 'gold', 'joya': 'treasure', 'joyas': 'treasure',
  'arma': 'weapon', 'armas': 'weapon', 'espada': 'sword', 'hacha': 'axe',
  'daga': 'dagger', 'arco': 'bow', 'ballesta': 'crossbow', 'lanza': 'spear',
  'sigilo': 'symbol', 'símbolo': 'symbol', 'simbolo': 'symbol',
  'estrella': 'star', 'luna': 'moon', 'sol': 'sun', 'círculo': 'circle', 'circulo': 'circle',
  'vela': 'candle', 'velas': 'candle', 'farol': 'lamp', 'antorcha': 'torch',
  'pozo': 'well', 'río': 'river', 'rio': 'river', 'laguna': 'lake', 'lago': 'lake',
  'isla': 'island', 'cueva3': 'cave', 'pozo2': 'well',

  // ambientes / mood
  'fantasía': 'fantasy', 'fantasia': 'fantasy', 'medieval': 'medieval',
  'horror': 'horror', 'terror': 'horror', 'malo': 'evil', 'oscuro': 'dark',
  'antiguo': 'ancient', 'antigua': 'ancient', 'viejo': 'ancient', 'veterano': 'veteran',
  'misterio': 'mystery', 'misterioso': 'mystery', 'secreto': 'secret',
  'maldición': 'curse', 'maldicion': 'curse', 'maldiciones': 'curse', 'maldito': 'curse',
  'peligro': 'danger', 'peligroso': 'danger', 'amenaza': 'danger',
  'investigar': 'investigation', 'investigación': 'investigation', 'investigacion': 'investigation',
  'indicio': 'evidence', 'indicios': 'evidence', 'pista': 'evidence', 'pistas': 'evidence',
  'prueba': 'evidence', 'pruebas': 'evidence', 'evidencia': 'evidence',
  'hablar': 'dialogue', 'conversación': 'dialogue', 'conversacion': 'dialogue',
  'charlar': 'dialogue', 'entrevista': 'interview', 'negociar': 'negotiation',
  'reunión': 'meeting', 'reunion': 'meeting', 'encuentro': 'meeting',
  'pelea': 'combat', 'lucha': 'combat', 'batalla': 'combat', 'ataque': 'combat',
  'atacar': 'combat', 'emboscada': 'ambush', 'acecho': 'ambush',
  'trampa': 'trap', 'cebo': 'trap', 'enigma': 'riddle', 'acertijo': 'riddle',
  'rompecabezas': 'puzzle',
  'exterior': 'outdoor', 'aire': 'outdoor', 'afuera': 'outdoor',
  'interior': 'indoor', 'dentro': 'indoor', 'adentro': 'indoor',
  'cálido': 'warm', 'calido': 'warm', 'caliente': 'warm', 'cálida': 'warm',
  'fuego': 'fire', 'llamas': 'fire', 'hoguera': 'campfire', 'fogata': 'campfire',
  'frío': 'snow', 'frio': 'snow', 'nieve': 'snow', 'invierno': 'snow',
  'hierba': 'outdoor', 'musgo': 'outdoor', 'verde': 'outdoor',
  'hierro': 'fire', 'brasa': 'fire', 'hoguerón': 'campfire'
}

function normalizeWord(w) {
  return SYNONYMS[w] || w
}

function tagEntity({ type, system, setting, title = '', description = '' } = {}) {
  const tags = new Set()
  if (type && TYPE_TAGS[type]) TYPE_TAGS[type].forEach(t => tags.add(t))
  if (system && SYSTEM_TAGS[system]) SYSTEM_TAGS[system].forEach(t => tags.add(t))
  if (setting && SETTING_TAGS[setting]) SETTING_TAGS[setting].forEach(t => tags.add(t))

  // Keywords del título y descripción → tags simples (con traducción ES→EN)
  const text = `${title} ${description}`.toLowerCase()
  const words = text.split(/[\s,;.()\[\]'"]+/)
  for (const raw of words) {
    if (raw.length < 3) continue
    if (STOPWORDS.has(raw)) continue
    const w = normalizeWord(raw)
    if (STOPWORDS.has(w)) continue
    tags.add(w)
  }
  return [...tags]
}

// ---- Matching ----

// ponytail: tipo/sistema/ambientación cuentan como UNA señal cada uno, no como
// varias. Antes conversation-expandía a 4 sinónimos y eso valía 4×3=12 puntos,
// mountaining a cualquier keyword del contenido. Ahora: tipo +3, sistema +2,
// ambientación +2, y cada keyword de contenido +2 (los keywords son lo que
// realmente discrimina: "mansión" > "discovery").
const STRONG_MAX = 3   // type: la señal de contenido más fuerte
const SYSTEM_W = 2
const SETTING_W = 2
const KEYWORD_W = 2

// ponytail: todos los valores que expanden type/system/setting se excluyen del
// scoring de keywords. Sin esto, conversation→[social,meeting,npc,talk] se
// contaban como type(+3) Y como 4 keywords(+8) = 11 puntos, mountaining
// cualquier imagen con contenido relevante.
const SIGNAL_TAGS = new Set([
  ...Object.values(TYPE_TAGS).flat(),
  ...Object.values(SYSTEM_TAGS).flat(),
  ...Object.values(SETTING_TAGS).flat()
])

// ponytail: IDF. Un tag presente en 1 imagen vale mucho más que uno en 10.
// Sin esto "bosque" (4 imágenes) empataba con "aldea" (1 imagen) y ganaba la
// imagen de combate en bosque en vez de la imagen de aldea.
let idfCache = null
function getIdf(manifest) {
  if (idfCache && idfCache.n === manifest.images.length) return idfCache.map
  const freq = new Map()
  for (const img of manifest.images) {
    for (const t of new Set(img.tags || [])) {
      freq.set(t, (freq.get(t) || 0) + 1)
    }
  }
  const n = manifest.images.length
  const map = new Map()
  for (const [tag, f] of freq) {
    map.set(tag, Math.log(n / f))
  }
  idfCache = { n, map }
  return map
}

function scoreMatch(entity, entityTags, image, idf) {
  const imgTags = new Set(image.tags || [])
  let score = 0

  if (entity.type && TYPE_TAGS[entity.type]) {
    if (TYPE_TAGS[entity.type].some(t => imgTags.has(t))) score += STRONG_MAX
  }
  if (entity.system && SYSTEM_TAGS[entity.system]) {
    if (SYSTEM_TAGS[entity.system].some(t => imgTags.has(t))) score += SYSTEM_W
  }
  if (entity.setting && SETTING_TAGS[entity.setting]) {
    if (SETTING_TAGS[entity.setting].some(t => imgTags.has(t))) score += SETTING_W
  }

  // Keywords de contenido, ponderados por rareza en la librería
  let keywordScore = 0
  let hits = 0
  for (const t of entityTags) {
    if (SIGNAL_TAGS.has(t)) continue
    if (!imgTags.has(t)) continue
    hits++
    keywordScore += (idf.get(t) ?? Math.log(4)) * KEYWORD_W
  }

  return { score: score + keywordScore, hits }
}

async function pickFromLibrary(entity) {
  const manifest = await loadLibrary()
  if (!manifest?.images?.length) return null
  const entityTags = tagEntity(entity)
  const idf = getIdf(manifest)
  let best = null
  let bestScore = 0
  let bestHits = 0
  for (const img of manifest.images) {
    const { score, hits } = scoreMatch(entity, entityTags, img, idf)
    // desempate por nº de keywords distintos
    if (score > bestScore || (score === bestScore && hits > bestHits)) {
      bestScore = score
      bestHits = hits
      best = img
    }
  }
  // threshold mínimo: si solo matchea sistema/ambientación preferimos dynamic
  // con el título real antes que una imagen genérica.
  return bestScore >= 6 ? best : null
}

// ---- Fallback dinámico (Pollinations URL directo, sin fetch) ----

function dynamicUrl(prompt, { width = 768, height = 512, seed = 1 } = {}) {
  const full = `${prompt}, fantasy or horror art, atmospheric, no text`
  const params = new URLSearchParams({ width, height, seed: String(seed), nologo: 'true' })
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?${params}`
}

// ---- Fallback visual: gradiente determinista ----

function hashString(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return Math.abs(h) >>> 0
}

export function fallbackGradient(seed) {
  const h = hashString(seed)
  const h1 = h % 360
  const h2 = (h1 + 50 + (h >> 8) % 40) % 360
  const s1 = 40 + (h >> 4) % 20
  const l1 = 18 + (h >> 12) % 10
  const l2 = 28 + (h >> 16) % 10
  return `linear-gradient(135deg, hsl(${h1} ${s1}% ${l1}%) 0%, hsl(${h2} ${s1}% ${l2}%) 100%)`
}

// ---- API pública ----

/**
 * Devuelve { url, gradient, source } para una entidad.
 * - source: 'library' | 'dynamic' | 'gradient'
 * - url: la URL a usar en <img src>. null si solo gradient.
 * - gradient: estilo de fondo siempre presente (safety net).
 */
export async function imageFor(entity, opts = {}) {
  const gradient = fallbackGradient(opts.fallbackSeed || entity.id || entity.name || 'roadrol')
  try {
    const lib = await pickFromLibrary(entity)
    if (lib) {
      return {
        url: `${LIBRARY_PATH}${lib.slug}.jpg`,
        gradient,
        source: 'library',
        tags: lib.tags,
        alt: entity.title || entity.name || ''
      }
    }
  } catch { /* fallback abajo */ }

  // Dynamic: Pollinations URL (puede fallar al cargar — gradient lo cubre)
  const prompt = entity.title || entity.name || entity.brief || 'fantasy scene'
  const seed = hashString(entity.id || prompt) % 100000
  return {
    url: dynamicUrl(prompt, { ...opts, seed }),
    gradient,
    source: 'dynamic',
    alt: prompt.slice(0, 100)
  }
}

// Para el wizard de setup: pre-genera y cachea en localStorage las imágenes
// de la mission. YAGNI: por ahora las URLs son directas (browser cachea).

// Helper para tags en URL (debug)
export function debugTags(entity) {
  return tagEntity(entity)
}
