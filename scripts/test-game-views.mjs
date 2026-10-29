#!/usr/bin/env node
// Check del render de la pantalla de partida tras extraer las vistas a game/views.js.
// renderView es un renderer puro (recibe state, devuelve HTML), asi que se puede
// ejecutar en Node sin DOM.
//
// Uso: node scripts/test-game-views.mjs
// Exit code 1 si algun caso falla.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { renderView } = await import(join(ROOT, 'src', 'ui', 'screens', 'game', 'views.js'))

const dndChars = [
  { id: 'c1', name: 'Thorin', stats: { hp: 25, maxHp: 32, ac: 17 } },
  { id: 'c2', name: 'Lyra', stats: { hp: 24, maxHp: 24, ac: 14 } }
]
const cocChars = [{ id: 'c3', name: 'Whately', stats: { hp: 11, maxHp: 11, san: 55 } }]

const baseGame = {
  id: 'g1', name: 'La Mina Perdida', system: 'dnd5e', setting: 'fantasy',
  characters: ['c1', 'c2'], status: 'active', missionCursor: 0, encounters: []
}

const CASES = [
  {
    label: 'partida nueva, sin encuentro',
    state: { game: { ...baseGame }, characters: dndChars, showMission: true, showDiceTray: false, missionImg: null, encounterImg: null },
    expect: [
      ['data-nav="/"', 'botón volver a inicio'],
      ['La Mina Perdida', 'título de la partida'],
      ['Sin encuentro activo', 'estado sin encuentro'],
      ['data-game-action="advance-encounter"', 'botón avanzar'],
      ['game__mission-banner', 'banner de misión sin contenido'],
      ['Thorin', 'personaje en sidebar'],
      ['No hay encuentro activo.', 'feed vacío sin encounter']
    ],
    reject: [['undefined', 'ningún undefined interpolado'], ['NaN', 'ningún NaN']]
  },
  {
    label: 'con encounter activo de combate',
    state: {
      game: {
        ...baseGame,
        mission: { title: 'Investigar la mina', brief: 'Robledo pide ayuda.', objectives: ['Encontrar al capataz'], encounters: [] },
        encounters: [
          { id: 'e1', type: 'combat', title: 'Emboscada en el puente', description: 'Tres goblins.', outcome: 'pending', rollHistory: [] }
        ],
        currentEncounterId: 'e1'
      },
      characters: dndChars, showMission: true, showDiceTray: true,
      diceExpression: '2d6+3', diceCharacterId: 'c1', lastDiceResult: null,
      missionImg: { url: '/images/library/dnd-forest-ambush.jpg', gradient: 'linear-gradient(135deg, hsl(20 40% 20%))' },
      encounterImg: { url: '/images/library/dnd-forest-ambush.jpg', gradient: 'linear-gradient(135deg, hsl(20 40% 20%))' }
    },
    expect: [
      ['Emboscada en el puente', 'título del encounter'],
      ['data-edit-encounter="title"', 'edición inline del título'],
      ['data-edit-encounter="description"', 'edición inline de la descripción'],
      ['data-dice-tray', 'bandeja de dados abierta'],
      ['2d6+3', 'expresión precargada'],
      ['Investigar la mina', 'misión en el banner'],
      ['Encontrar al capataz', 'objetivo de la misión'],
      ['dnd-forest-ambush.jpg', 'imagen del encounter'],
      ['data-game-action="finalize"', 'botón finalizar']
    ],
    reject: [['undefined', 'sin undefined'], ['<script', 'sin HTML inyectado']]
  },
  {
    label: 'encounter resuelto con tiradas',
    state: {
      game: {
        ...baseGame,
        encounters: [{
          id: 'e2', type: 'puzzle', title: 'La puerta de los cuatro símbolos',
          description: 'Un relieve solar.', outcome: 'resolved', rollHistory: [
            { characterId: 'c1', expression: '1d20+5', result: 18, ts: new Date('2026-10-23T10:32:00Z').toISOString() },
            { characterId: null, expression: '2d6', result: 7, ts: new Date('2026-10-23T10:31:00Z').toISOString() }
          ]
        }],
        currentEncounterId: 'e2'
      },
      characters: dndChars, showMission: true, showDiceTray: false,
      missionImg: null, encounterImg: null
    },
    expect: [
      ['✓ Resuelto', 'marca de resuelto'],
      ['1d20+5', 'expresión en el feed'],
      ['>18<', 'resultado en el feed'],
      ['Tiradas (2)', 'contador de tiradas']
    ],
    reject: [['undefined', 'sin undefined']]
  },
  {
    label: 'CoC muestra SAN, no CA',
    state: {
      game: { id: 'g2', name: 'Arkham', system: 'cthulhu', setting: 'horror', characters: ['c3'], status: 'active', missionCursor: 0, encounters: [] },
      characters: cocChars, showMission: false, showDiceTray: false,
      missionImg: null, encounterImg: null
    },
    expect: [['SAN', 'vital secundario de CoC']],
    reject: [['>CA<', 'no debe mostrar CA en CoC'], ['undefined', 'sin undefined']]
  }
]

let pass = 0, fail = 0

for (const c of CASES) {
  console.log(`\n${c.label}`)
  let html
  try {
    html = renderView(c.state)
  } catch (err) {
    console.log(`  ✗ renderView lanzó: ${err.message}`)
    fail++
    continue
  }

  for (const [needle, desc] of c.expect) {
    const ok = html.includes(needle)
    if (!ok) fail++
    console.log(`  ${ok ? '✓' : '✗'} contiene ${desc}`)
  }
  for (const [needle, desc] of (c.reject || [])) {
    const bad = html.includes(needle)
    if (bad) fail++
    console.log(`  ${bad ? '✗' : '✓'} ${desc}`)
  }
  pass++
}

console.log(`\n${CASES.length} casos renderizados, ${fail} fallo(s)`)
if (fail > 0) process.exit(1)