// Modelos: JSDoc + el normalizador que rellena los huecos de un Game.
// ponytail: una sola función, en vez de un validador por campo. Los datos
// llegan de 3 sitios (IndexedDB, import JSON, seed) y solo necesitamos que
// no crasheen al renderizar.

import { newId } from './id.js'

export const SCHEMA_VERSION = 1

/**
 * @typedef {Object} Character
 * @property {string} id
 * @property {string} name
 * @property {string} system    id del sistema ('dnd5e', 'cthulhu', …)
 * @property {string} setting   id de ambientación ('fantasy', 'horror', …)
 * @property {Object} stats     stats específicas del sistema (forma libre hasta fase 2)
 * @property {string} notes
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Roll
 * @property {string|null} characterId  null si es NPC o master
 * @property {string} expression       ej. '2d6+3'
 * @property {number} result
 * @property {string} ts
 */

/** @typedef {'combat'|'puzzle'|'trap'|'conversation'} EncounterType */
/** @typedef {'pending'|'resolved'} Outcome */

/**
 * @typedef {Object} Encounter
 * @property {string} id
 * @property {EncounterType} type
 * @property {string} title
 * @property {string} description
 * @property {Outcome} outcome
 * @property {string} masterNotes
 * @property {Roll[]} rollHistory
 * @property {string|null} resolvedAt
 */

/** @typedef {'setup'|'active'|'finished'} GameStatus */

/**
 * @typedef {Object} Game
 * @property {string} id
 * @property {string} name
 * @property {string} system
 * @property {string} setting
 * @property {GameStatus} status
 * @property {string[]} characters      ids de Character
 * @property {Object|null} mission      { title, brief, objectives[], encounters[], sourcePackId, sourceMissionId }
 * @property {Encounter[]} encounters
 * @property {string|null} currentEncounterId
 * @property {number} missionCursor
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} PackEncounterTemplate
 * @property {EncounterType} type
 * @property {string} title
 * @property {string} description
 * @property {string} [difficulty]
 * @property {string} [rewards]
 */

/**
 * @typedef {Object} PackMission
 * @property {string} id
 * @property {string} title
 * @property {string} brief
 * @property {string[]} [objectives]
 * @property {PackEncounterTemplate[]} encounters
 */

/**
 * @typedef {Object} Pack
 * @property {string} id
 * @property {string} name
 * @property {string} system
 * @property {string} [setting]
 * @property {PackMission[]} missions
 * @property {string} importedAt
 */

/**
 * Rellena los campos que falten de un Game para que la UI pueda leerlos sin
 * comprobar null en cada sitio. Muta el objeto y lo devuelve.
 *
 * ponytail: sin esquema por versión. Un Game importado a mano o de una versión
 * vieja solo necesitaDefaults para no reventar el render; los campos que de
 * verdad importan (name, system) se validan en la entrada, no aquí.
 *
 * @param {Game} game
 * @returns {Game}
 */
export function normalizeGame(game) {
  if (!game || typeof game !== 'object') return game

  if (!Array.isArray(game.characters)) game.characters = []
  if (!Array.isArray(game.encounters)) game.encounters = []
  if (!Number.isFinite(game.missionCursor)) game.missionCursor = 0
  if (!game.currentEncounterId) game.currentEncounterId = null
  if (game.mission === undefined) game.mission = null

  game.encounters = game.encounters
    .filter(e => e && typeof e === 'object')
    .map((e, i) => {
      if (!e.id) e.id = newId()
      if (!e.type) e.type = 'combat'
      if (typeof e.title !== 'string' || !e.title) e.title = `Encuentro ${i + 1}`
      if (typeof e.description !== 'string') e.description = ''
      if (e.outcome !== 'resolved') e.outcome = 'pending'
      if (typeof e.masterNotes !== 'string') e.masterNotes = ''
      if (!Array.isArray(e.rollHistory)) e.rollHistory = []
      e.rollHistory = e.rollHistory
        .filter(r => r && typeof r === 'object')
        .map(r => {
          if (!r.ts) r.ts = new Date().toISOString()
          if (r.characterId === undefined) r.characterId = null
          if (r.expression === undefined) r.expression = ''
          if (r.result === undefined) r.result = 0
          return r
        })
      if (e.resolvedAt === undefined) e.resolvedAt = null
      return e
    })

  return game
}

