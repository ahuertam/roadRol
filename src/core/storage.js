// Wrapper IndexedDB. Tres object stores: characters, games y packs.
// ponytail: apertura lazy (singleton). Migración v1 → v2 añade 'packs'.

import { openDB } from 'idb'
import { newId } from './id.js'

const DB_NAME = 'roadrol'
const DB_VERSION = 2

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('characters', { keyPath: 'id' })
          db.createObjectStore('games', { keyPath: 'id' })
        }
        if (oldVersion < 2) {
          db.createObjectStore('packs', { keyPath: 'id' })
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

// ----- Packs -----

export async function listPacks() {
  return (await getDB()).getAll('packs')
}

export async function getPack(id) {
  return (await getDB()).get('packs', id)
}

export async function savePack(/** @type {Pack} */ pack) {
  const db = await getDB()
  const now = new Date().toISOString()
  const p = {
    ...pack,
    id: pack.id || newId(),
    importedAt: pack.importedAt ?? now
  }
  await db.put('packs', p)
  return p
}

export async function deletePack(id) {
  return (await getDB()).delete('packs', id)
}
