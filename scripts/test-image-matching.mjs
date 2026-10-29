#!/usr/bin/env node
// Check del matching entity→imagen. Corre la lógica real de core/images.js
// contra la librería y verifica que los casos de los 25 packs eligen la imagen
// semánticamente correcta.
//
// Uso: node scripts/test-image-matching.mjs
// Exit code 1 si algún caso falla.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST = join(ROOT, 'public', 'images', 'library', 'manifest.json')

const { debugTags } = await import(join(ROOT, 'src', 'core', 'images.js'))

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

// Replica exacta de la lógica en images.js (tagEntity vive dentro y no se
// exporta; debugTags la usa para los tags, el scoring se replica aquí).
const TYPE_TAGS = {
  combat: ['combat', 'battle', 'fight'],
  puzzle: ['puzzle', 'riddle', 'enigma'],
  trap: ['trap', 'hazard'],
  conversation: ['dialogue', 'negotiation', 'interview'],
  discovery: ['evidence', 'revelation', 'investigation']
}
const SYSTEM_TAGS = { dnd5e: ['dnd5e', 'fantasy'], cthulhu: ['cthulhu', 'horror'] }
const SETTING_TAGS = { fantasy: ['fantasy', 'medieval', 'magic'], horror: ['horror', 'lovecraftian', 'eldritch'] }
const SIGNAL_TAGS = new Set([
  ...Object.values(TYPE_TAGS).flat(),
  ...Object.values(SYSTEM_TAGS).flat(),
  ...Object.values(SETTING_TAGS).flat()
])
const STRONG_MAX = 3, SYSTEM_W = 2, SETTING_W = 2, KEYWORD_W = 2, MIN_SCORE = 6

const IDF = (() => {
  const freq = new Map()
  for (const img of manifest.images) {
    for (const t of new Set(img.tags || [])) freq.set(t, (freq.get(t) || 0) + 1)
  }
  const n = manifest.images.length
  const map = new Map()
  for (const [tag, f] of freq) map.set(tag, Math.log(n / f))
  return map
})()

function scoreMatch(entity, entityTags, image) {
  const imgTags = new Set(image.tags || [])
  let score = 0
  if (entity.type && TYPE_TAGS[entity.type] && TYPE_TAGS[entity.type].some(t => imgTags.has(t))) score += STRONG_MAX
  if (entity.system && SYSTEM_TAGS[entity.system] && SYSTEM_TAGS[entity.system].some(t => imgTags.has(t))) score += SYSTEM_W
  if (entity.setting && SETTING_TAGS[entity.setting] && SETTING_TAGS[entity.setting].some(t => imgTags.has(t))) score += SETTING_W
  let kw = 0, hits = 0
  for (const t of entityTags) {
    if (SIGNAL_TAGS.has(t)) continue
    if (!imgTags.has(t)) continue
    hits++
    kw += (IDF.get(t) ?? Math.log(4)) * KEYWORD_W
  }
  return { score: score + kw, hits }
}

function pick(entity) {
  const tags = debugTags(entity)
  let best = null, bestScore = 0, bestHits = 0
  for (const img of manifest.images) {
    const { score, hits } = scoreMatch(entity, tags, img)
    if (score > bestScore || (score === bestScore && hits > bestHits)) {
      bestScore = score; bestHits = hits; best = img
    }
  }
  return bestScore >= MIN_SCORE ? { slug: best.slug, score: bestScore } : null
}

// Casos reales extraídos de los 25 packs. expected = slugs aceptables.
const CASES = [
  {
    label: 'Misión Aldebrook (aldea + bosque)',
    expected: ['dnd-village'],
    entity: {
      system: 'dnd5e', setting: 'fantasy',
      title: 'Las desapariciones de Aldebrook',
      description: 'pueblo de Aldebrook, bosque de Robledo, leñadores desaparecidos, alcalde Ernan Birchwood'
    }
  },
  {
    label: 'Ermitaña Morwen (bosque + conversación)',
    expected: ['dnd-fey-grove', 'dnd-campfire-night', 'dnd-forest-ambush'],
    entity: {
      system: 'dnd5e', setting: 'fantasy', type: 'conversation',
      title: 'La ermitaña Morwen',
      description: 'cabaña de piedra cubierta de musgo, robledo milenario en el bosque'
    }
  },
  {
    label: 'Corazón Putrefacto (combate + horror)',
    expected: ['dnd-undead-crypt', 'dnd-forest-ambush', 'dnd-dragon-lair'],
    entity: {
      system: 'dnd5e', setting: 'fantasy', type: 'combat',
      title: 'El Corazón Putrefacto',
      description: 'corazón de carne negra latiendo con tentáculos, robledo, arbusto animado'
    }
  },
  {
    label: 'Trampa de raíces (trap + bosque)',
    expected: ['dnd-fey-grove', 'dnd-dungeon-corridor', 'dnd-forest-ambush'],
    entity: {
      system: 'dnd5e', setting: 'fantasy', type: 'trap',
      title: 'Las raíces que atrapan',
      description: 'raíces del suelo se cierran alrededor, turba blanda, bosque'
    }
  },
  {
    label: 'Trampa puerta de runas (puzzle)',
    expected: ['dnd-puzzle-door', 'dnd-ancient-ruins'],
    entity: {
      system: 'dnd5e', setting: 'fantasy', type: 'puzzle',
      title: 'La puerta de los cinco robles',
      description: 'cinco robles con runas antiguas, puerta de piedra, acertijo'
    }
  },
  {
    label: 'Mansión Whately (mansión gótica)',
    expected: ['coc-mansion-exterior'],
    entity: {
      system: 'cthulhu', setting: 'horror', type: 'discovery',
      title: 'La mansión Whately',
      description: 'casa gótica con luna llena, árboles muertos, Innsmouth Road'
    }
  },
  {
    label: 'Ritual en la iglesia (culto + ritual)',
    expected: ['coc-ritual-circle', 'coc-cultist-meeting'],
    entity: {
      system: 'cthulhu', setting: 'horror', type: 'combat',
      title: 'El ritual en la iglesia de la Trinidad',
      description: 'cultistas, círculo de ritual, símbolos de sangre, invocación'
    }
  },
  {
    label: 'Deep ones en Innsmouth (puerto + criaturas)',
    expected: ['coc-tentacle-creature', 'coc-port-fog', 'coc-eldritch-horror'],
    entity: {
      system: 'cthulhu', setting: 'horror', type: 'combat',
      title: 'La hembra y sus crías',
      description: 'criaturas con ojos de pescado y tentáculos, Padre Dagon, muelle del pueblo portuario con niebla'
    }
  },
  {
    label: 'Sanatorio (asilo + interior)',
    expected: ['coc-asylum-corridor', 'coc-hospital-vintage'],
    entity: {
      system: 'cthulhu', setting: 'horror', type: 'discovery',
      title: 'El Sanatorio de Piedra Gris',
      description: 'pasillo del manicomio con pintura descascarada, silla de ruedas, enfermeros'
    }
  },
  {
    label: 'Taberna del Brujo (social + interior)',
    expected: ['dnd-tavern'],
    entity: {
      system: 'dnd5e', setting: 'fantasy', type: 'conversation',
      title: 'El Brujo Encapuchado en la taberna',
      description: 'taberna cálida junto al fuego, el mago espera con una jarra de cerveza'
    }
  }
]

console.log(`Librería: ${manifest.images.length} imágenes`)
console.log(`Casos: ${CASES.length}\n`)

let pass = 0, fail = 0
for (const c of CASES) {
  const got = pick(c.entity)
  const slug = got ? got.slug : null
  const ok = slug !== null && c.expected.includes(slug)
  if (ok) pass++; else fail++
  const mark = ok ? '✓' : '✗'
  const detail = got ? `${got.slug} (score ${got.score})` : 'sin match → dynamic fallback'
  console.log(`${mark} ${c.label}`)
  console.log(`    → ${detail}`)
  if (!ok) console.log(`    esperado: ${c.expected.join(' | ')}`)
}

console.log(`\n${pass}/${CASES.length} correctos`)
if (fail > 0) process.exit(1)