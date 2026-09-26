// Seed inicial: dos personajes D&D 5e para que la galería no esté vacía
// al primer arranque. Idempotente — solo corre si characters está vacío.

import { listCharacters, saveCharacter } from './storage.js'
import { newId } from './id.js'

// ponytail: cuando llegue la fase 2 (módulos de sistema), el validador del
// sistema verificará el shape exacto de stats. Mientras tanto, basta con la forma.
const SEED = [
  {
    name: 'Thorin Escudo de Roble',
    system: 'dnd5e',
    setting: 'fantasy',
    stats: { hp: 32, maxHp: 32, ac: 17, str: 16, dex: 11, con: 15, int: 9, wis: 13, cha: 12 },
    notes: 'Enano, busca vengar a su clan.'
  },
  {
    name: 'Lyra Susurro de Hoja',
    system: 'dnd5e',
    setting: 'fantasy',
    stats: { hp: 24, maxHp: 24, ac: 14, str: 9, dex: 17, con: 12, int: 13, wis: 15, cha: 11 },
    notes: 'Elfa, ex-militar del Bosque Eterno.'
  }
]

export async function seedIfEmpty() {
  const existing = await listCharacters()
  if (existing.length > 0) return 0

  const now = new Date().toISOString()
  for (const partial of SEED) {
    await saveCharacter({
      id: newId(),
      ...partial,
      createdAt: now,
      updatedAt: now
    })
  }
  return SEED.length
}
