// Wrapper IndexedDB. Dos object stores: characters y games.
// ponytail: apertura lazy (singleton). Cada función abre la DB solo si hace falta.

import { openDB } from 'idb'
import { newId } from './id.js'

const DB_NAME = 'roadrol'
const DB_VERSION = 1

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('characters')) {
          db.createObjectStore('characters', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('games')) {
          db.createObjectStore('games', { keyPath: 'id' })
        }
      }
    })
  }
  return dbPromise
}

// ----- Characters -----

export async function listCharacters() {
  return (await getDB()).getAll('characters')
}

export async function getCharacter(id) {
  return (await getDB()).get('characters', id)
}

export async function saveCharacter(/** @type {Character} */ character) {
  const db = await getDB()
  const now = new Date().toISOString()
  const c = {
    ...character,
    // ponytail: || en vez de ?? para que un id vacío se considere ausente.
    // ?? solo dispara con null/undefined, no con ''.
    id: character.id || newId(),
    createdAt: character.createdAt ?? now,
    updatedAt: now
  }
  await db.put('characters', c)
  return c
}

export async function deleteCharacter(id) {
  return (await getDB()).delete('characters', id)
}

// ----- Games -----

export async function listGames() {
  return (await getDB()).getAll('games')
}

export async function getGame(id) {
  return (await getDB()).get('games', id)
}

export async function saveGame(/** @type {Game} */ game) {
  const db = await getDB()
  const now = new Date().toISOString()
  const g = {
    ...game,
    // ponytail: || en vez de ?? para que un id vacío se considere ausente.
    id: game.id || newId(),
    createdAt: game.createdAt ?? now,
    updatedAt: now
  }
  await db.put('games', g)
  return g
}

export async function deleteGame(id) {
  return (await getDB()).delete('games', id)
}
