#!/usr/bin/env node
// Checks de regresion de los bugs de P0 (ver el review).
//
// 1. Un Game incompleto (importado a mano, de una version vieja) no puede
//    reventar el render de la pantalla de partida.
// 2. Los atributos de edicion inline de la tarjeta de personaje tienen que
//    coincidir con los que conecta gallery.js.
// 3. Si una partida referencia personajes que no estan en el dispositivo, hay
//    que avisar.
//
// Uso: node scripts/test-regressions.mjs
// Exit code 1 si falla.

const { normalizeGame } = await import('../src/core/models.js')
const { renderView } = await import('../src/ui/screens/game/views.js')
const { renderCharacterCard } = await import('../src/ui/components/characterCard.js')

let fail = 0

function check(label, ok) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) fail++
}

console.log('partida importada a mano (minima)')
{
  const g = normalizeGame({
    id: 'g1',
    name: 'La Mina Perdida',
    system: 'dnd5e',
    setting: 'fantasy',
    status: 'active',
    characters: ['c1'],
    encounters: [{ title: 'Emboscada en el puente' }],
    currentEncounterId: 'e1'
  })

  check('los encounters son un array', Array.isArray(g.encounters))
  check('los characters son un array', Array.isArray(g.characters))
  check('el encounter recibe id', typeof g.encounters[0].id === 'string' && g.encounters[0].id.length > 0)
  check('el encounter recibe type', g.encounters[0].type === 'combat')
  check('el encounter recibe outcome', g.encounters[0].outcome === 'pending')
  check('el encounter recibe rollHistory array', Array.isArray(g.encounters[0].rollHistory))
  check('el encounter recibe description string', typeof g.encounters[0].description === 'string')
  check('el missionCursor es 0', g.missionCursor === 0)
  check('la mission es null', g.mission === null)

  // Este es el bug que existia: enc.rollHistory.slice() reventaba el render.
  const html = renderView({
    game: g,
    characters: [{ id: 'c1', name: 'Thorin', stats: { hp: 25, maxHp: 32, ac: 17 } }],
    missingCharIds: [],
    showMission: true, showDiceTray: false, missionImg: null, encounterImg: null
  })
  check('la pantalla de partida renderiza sin reventar', typeof html === 'string' && html.length > 0)
  check('el render no contiene undefined', !html.includes('undefined'))
  check('el render no contiene NaN', !html.includes('NaN'))
}

console.log('\npartida valida (no debe perder datos)')
{
  const mission = { title: 'Investigar la mina', brief: 'Robledo pide ayuda.', objectives: [], encounters: [] }
  const g = normalizeGame({
    id: 'g2', name: 'X', system: 'dnd5e', setting: 'fantasy', status: 'active',
    characters: ['c1'], mission, missionCursor: 3, currentEncounterId: 'e1',
    encounters: [{
      id: 'e1', type: 'puzzle', title: 'Cofre cerrado', description: 'Un acertijo.',
      outcome: 'resolved', masterNotes: 'notas', resolvedAt: '2026-01-01T00:00:00.000Z',
      rollHistory: [{ characterId: 'c1', expression: '1d20+3', result: 17, rolls: [14], ts: '2026-01-01T00:00:00.000Z' }]
    }]
  })

  check('conserva el missionCursor', g.missionCursor === 3)
  check('conserva la mission', g.mission === mission)
  check('conserva el currentEncounterId', g.currentEncounterId === 'e1')
  check('conserva el outcome resuelto', g.encounters[0].outcome === 'resolved')
  check('conserva el type', g.encounters[0].type === 'puzzle')
  check('conserva el id del encounter', g.encounters[0].id === 'e1')
  check('conserva el resolvedAt', g.encounters[0].resolvedAt === '2026-01-01T00:00:00.000Z')
  check('conserva las tiradas', g.encounters[0].rollHistory.length === 1)
  check('conserva el resultado de la tirada', g.encounters[0].rollHistory[0].result === 17)
}

console.log('\ntiradas sin timestamp')
{
  const g = normalizeGame({
    id: 'g3', name: 'Y', system: 'dnd5e', setting: 'fantasy', status: 'active',
    characters: [], encounters: [{ id: 'e1', title: 'T', outcome: 'resolved',
      rollHistory: [{ characterId: null, expression: '2d6', result: 9 }] }]
  })
  check('la tirada recibe ts', typeof g.encounters[0].rollHistory[0].ts === 'string')
  check('la tirada recibe characterId null', g.encounters[0].rollHistory[0].characterId === null)
}

console.log('\nencounters invalidos')
{
  const g = normalizeGame({
    id: 'g4', name: 'Z', system: 'dnd5e', setting: 'fantasy', status: 'active',
    characters: 'esto-no-es-un-array',
    encounters: [null, 'basura', { id: 'e9', title: 'Vale' }]
  })
  check('descarta los encounters que no son objetos', g.encounters.length === 1)
  check('los characters degenerados se vuelven array', Array.isArray(g.characters) && g.characters.length === 0)
}

console.log('\ngalería: atributos de edición inline')
{
  // gallery.js conecta [data-edit-stat]. La tarjeta tiene que emitir ese
  // mismo atributo en TODOS los stats, incluido el vital secundario (SAN/CA).
  const coc = renderCharacterCard({
    id: 'c1', name: 'Whately', system: 'cthulhu', setting: 'horror',
    stats: { hp: 11, maxHp: 11, san: 55 }
  })
  const dnd = renderCharacterCard({
    id: 'c2', name: 'Thorin', system: 'dnd5e', setting: 'fantasy',
    stats: { hp: 25, maxHp: 32, ac: 17 }
  })
  check('CoC: hp, maxHp y san usan data-edit-stat (3)',
    (coc.match(/data-edit-stat=/g) || []).length === 3)
  check('D&D: hp, maxHp y ac usan data-edit-stat (3)',
    (dnd.match(/data-edit-stat=/g) || []).length === 3)
  check('no queda el atributo viejo data-stat-edit',
    !coc.includes('data-stat-edit') && !dnd.includes('data-stat-edit'))
}

console.log('\naviso de personajes ausentes')
{
  const html = renderView({
    game: {
      id: 'g5', name: 'X', system: 'dnd5e', setting: 'fantasy', status: 'active',
      characters: ['c1', 'c9'], missionCursor: 0, encounters: []
    },
    characters: [{ id: 'c1', name: 'Thorin', stats: { hp: 25, maxHp: 32, ac: 17 } }],
    missingCharIds: ['c9'],
    showMission: true, showDiceTray: false, missionImg: null, encounterImg: null
  })
  check('avisa de los personajes que no están en el dispositivo',
    html.includes('no están en este dispositivo'))
  check('no avisa cuando no falta ninguno', !renderView({
    game: { id: 'g6', name: 'X', system: 'dnd5e', setting: 'fantasy', status: 'active',
      characters: ['c1'], missionCursor: 0, encounters: [] },
    characters: [{ id: 'c1', name: 'Thorin', stats: { hp: 25, maxHp: 32, ac: 17 } }],
    missingCharIds: [],
    showMission: true, showDiceTray: false, missionImg: null, encounterImg: null
  }).includes('no están en este dispositivo'))
}

console.log(`\n${fail} fallo(s)`)
if (fail > 0) process.exit(1)
