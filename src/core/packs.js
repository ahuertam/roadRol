// Gestión de packs de misiones. Un pack es un JSON con esta forma:
//
//   {
//     "name": "La Mina Perdida",
//     "system": "dnd5e",
//     "setting": "fantasy",
//     "missions": [
//       {
//         "title": "Investigar la mina",
//         "brief": "...",
//         "objectives": ["..."],
//         "encounters": [
//           { "type": "combat", "title": "...", "description": "...", "difficulty": "medium", "rewards": "..." }
//         ]
//       }
//     ]
//   }
//
// Se importa desde archivo, se valida y se guarda en IndexedDB.

import { listPacks, getPack, savePack, deletePack } from './storage.js'
import { getSystem, getSetting } from '../modules/index.js'
import { readJSONFile } from './importExport.js'
import { newId } from './id.js'

const VALID_ENCOUNTER_TYPES = ['combat', 'puzzle', 'trap', 'conversation', 'discovery']
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'deadly']

/** Lee un File, lo valida, lo guarda como Pack. Lanza Error si algo falla. */
export async function importPackFromFile(file) {
  const raw = await readJSONFile(file)
  return importPackFromJSON(raw)
}

/** Importa un pack ya parseado como objeto. Acepta { schema, pack }, { entity } o pack directo. */
export async function importPackFromJSON(raw) {
  const pack = raw?.pack || raw?.entity || raw
  validatePack(pack)
  return savePack({
    ...pack,
    id: newId(),
    importedAt: new Date().toISOString()
  })
}

/** Importa todos los JSONs de /samples/ de un golpe. Devuelve { imported, skipped }. */
export async function importSamplePacks() {
  // Listado explícito para no depender de un directory listing.
  const samples = [
    'pack-mina-perdida.json',
    'pack-bosque-maldito.json',
    'pack-expediente-whately.json',
    'pack-galeon-maldito.json',
    'pack-tumba-faraon.json',
    'pack-asedio-piedra-alta.json',
    'pack-robo-torre-cristal.json',
    'pack-bosque-susurros.json',
    'pack-profundidades-innsmouth.json',
    'pack-sanatorio-abandonado.json',
    'pack-culto-ojo.json',
    'pack-momia-museo.json',
    'pack-nave-estrellas.json'
  ]
  let imported = 0
  const errors = []
  for (const filename of samples) {
    try {
      const resp = await fetch(`/samples/${filename}`)
      if (!resp.ok) {
        errors.push(`${filename}: HTTP ${resp.status}`)
        continue
      }
      const json = await resp.json()
      await importPackFromJSON(json)
      imported++
    } catch (e) {
      errors.push(`${filename}: ${e.message}`)
    }
  }
  return { imported, errors, total: samples.length }
}

export function validatePack(pack) {
  if (!pack || typeof pack !== 'object') throw new Error('Pack inválido')
  if (typeof pack.name !== 'string' || !pack.name.trim()) throw new Error('Falta name')
  if (typeof pack.system !== 'string') throw new Error('Falta system')
  if (!getSystem(pack.system)) throw new Error(`Sistema desconocido: "${pack.system}"`)
  if (pack.setting && !getSetting(pack.setting)) {
    throw new Error(`Ambientación desconocida: "${pack.setting}"`)
  }
  if (!Array.isArray(pack.missions)) throw new Error('Falta missions (array)')

  for (let i = 0; i < pack.missions.length; i++) {
    const m = pack.missions[i]
    if (!m.title) throw new Error(`Misión ${i + 1}: falta title`)
    if (typeof m.brief !== 'string') throw new Error(`Misión ${i + 1}: falta brief`)
    if (m.objectives && !Array.isArray(m.objectives)) {
      throw new Error(`Misión ${i + 1}: objectives debe ser array`)
    }
    if (!Array.isArray(m.encounters)) {
      throw new Error(`Misión ${i + 1}: falta encounters (array)`)
    }
    for (let j = 0; j < m.encounters.length; j++) {
      const e = m.encounters[j]
      if (e.type && !VALID_ENCOUNTER_TYPES.includes(e.type)) {
        throw new Error(`Encuentro ${j + 1} de misión ${i + 1}: tipo "${e.type}" no válido`)
      }
      if (e.difficulty && !VALID_DIFFICULTIES.includes(e.difficulty)) {
        throw new Error(`Encuentro ${j + 1} de misión ${i + 1}: difficulty "${e.difficulty}" no válido`)
      }
    }
  }
}

/** Re-exporta las funciones de storage para conveniencia. */
export { listPacks, getPack, savePack, deletePack }
