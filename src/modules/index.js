// Registro y carga de sistemas y ambientaciones.
// ponytail: Map para lookup O(1), la lista es para iterar/mostrar.

import dnd5e   from './systems/dnd5e.js'
import cthulhu from './systems/cthulhu.js'
import fantasy from './settings/fantasy.js'
import horror  from './settings/horror.js'

export const systems  = [dnd5e, cthulhu]
export const settings = [fantasy, horror]

const _sysMap = new Map(systems.map(s => [s.id, s]))
const _setMap = new Map(settings.map(s => [s.id, s]))

export function getSystem(id) {
  return _sysMap.get(id) || null
}

export function getSetting(id) {
  return _setMap.get(id) || null
}
