// JSDoc + constantes compartidas. No genera código en runtime.

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
 * @property {Object|null} mission      { title, brief, objectives[] }
 * @property {Encounter[]} encounters
 * @property {string|null} currentEncounterId
 * @property {string} createdAt
 * @property {string} updatedAt
 */
