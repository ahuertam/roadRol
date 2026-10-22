// Pantalla principal de partida (master). Estado + acciones.
//
// Estado:
//   - game: el objeto Game de IndexedDB
//   - characters: Personajes[] resueltos desde game.characters
//   - lastDiceResult: para mostrar en la bandeja de dados
//   - showDiceTray, showMission: UI local
//   - missionImg / encounterImg: pre-computados en core/images.js
//
// game.mission (opcional) trae una mission del pack con su lista de encounter
// templates. Al pulsar "Siguiente encuentro" se clona el siguiente template
// como game encounter; cuando se agotan, se crean blancos.
//
// Los renderers puros viven en ./views.js — aquí solo hay lógica y cables.

import { getGame, saveGame, getCharacter, saveCharacter } from '../../../core/storage.js'
import { getSystem } from '../../../modules/index.js'
import { rollAnimated } from '../../../core/dice.js'
import { newId } from '../../../core/id.js'
import { imageFor } from '../../../core/images.js'
import { renderView } from './views.js'

export async function renderGame(params, container) {
  const game = await getGame(params.id)
  if (!game) {
    container.innerHTML = `<main class="screen placeholder">Partida no encontrada.<br><br><button class="btn btn--ghost" data-nav="/">← Inicio</button></main>`
    return
  }

  const characters = await loadGameCharacters(game.characters)

  // ponytail: normaliza campos que luego se usan sin guard (8 accesos a
  // state.game.encounters). Un game importado a mano o de una versión vieja
  // sin encounters crasheaba con TypeError en el primer render.
  if (!Array.isArray(game.encounters)) game.encounters = []
  if (!Array.isArray(game.characters)) game.characters = []

  // Pre-computar imágenes para mission + encounter actual. La library se cachea
  // internamente, así que tras la primera pantalla es instantáneo.
  const currentEnc = game.encounters.find(e => e.id === game.currentEncounterId) || null
  const [missionImg, encounterImg] = await Promise.all([
    imageFor({
      id: 'mission-' + game.id,
      title: game.mission?.title || game.name,
      system: game.system,
      setting: game.setting
    }),
    currentEnc
      ? imageFor({
          id: 'encounter-' + currentEnc.id,
          title: currentEnc.title,
          description: currentEnc.description,
          type: currentEnc.type,
          system: game.system,
          setting: game.setting
        })
      : Promise.resolve(null)
  ])

  // ponytail: recuerda la última expresión y personaje usado por game.id,
  // para no resetear a '1d20' cada vez que el master navega fuera y vuelve.
  const prefsKey = `roadrol.game.${game.id}.dicePrefs`
  const savedPrefs = loadPrefs(prefsKey)

  // si el personaje guardado fue borrado, resetea el id para no rodar tiradas
  // con characterId huérfano. Persiste el reset.
  const validCharIds = new Set(characters.map(c => c.id))
  const safeCharId = savedPrefs.characterId && validCharIds.has(savedPrefs.characterId)
    ? savedPrefs.characterId
    : ''

  const state = {
    game,
    characters,
    showMission: true,
    showDiceTray: false,
    diceExpression: savedPrefs.expression || '1d20',
    diceCharacterId: safeCharId,
    lastDiceResult: null,
    missionImg,
    encounterImg
  }
  if (savedPrefs.characterId && !safeCharId) savePrefs(prefsKey, state)

  function savePrefsNow() {
    savePrefs(prefsKey, state)
  }

  function paint() {
    container.innerHTML = renderView(state)
    wire()
  }

  function wire() {
    container.querySelector('[data-toggle-mission]')?.addEventListener('click', () => {
      state.showMission = !state.showMission
      paint()
    })

    container.querySelectorAll('[data-game-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleGameAction(btn.dataset.gameAction))
    })

    wireEncounterEdit()

    container.querySelectorAll('[data-stat-edit]').forEach((el) => {
      el.addEventListener('click', () => beginStatEdit(el))
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          beginStatEdit(el)
        }
      })
    })

    wireDiceTray()
  }

  function wireDiceTray() {
    const tray = container.querySelector('[data-dice-tray]')
    if (!tray) return

    const exprInput = tray.querySelector('[data-dice-expr]')
    const charSelect = tray.querySelector('[data-dice-character]')

    exprInput.addEventListener('input', () => {
      state.diceExpression = exprInput.value
      savePrefsNow()
    })
    exprInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doRoll() }
    })
    charSelect.addEventListener('change', () => {
      state.diceCharacterId = charSelect.value
      savePrefsNow()
    })
    tray.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.diceExpression = btn.dataset.preset
        savePrefsNow()
        paint()
        // Re-focus el input tras repintar
        const next = container.querySelector('[data-dice-expr]')
        if (next) { next.focus(); next.select() }
      })
    })
    tray.querySelector('[data-dice-cancel]')?.addEventListener('click', () => {
      state.showDiceTray = false
      state.lastDiceResult = null
      paint()
    })
    tray.querySelector('[data-dice-roll]')?.addEventListener('click', () => doRoll())
  }

  async function doRoll() {
    let result
    try {
      result = await rollAnimated(state.diceExpression, 500, (current) => {
        // feedback en vivo mientras dura la animación
        const tray = container.querySelector('[data-dice-tray]')
        if (!tray) return
        let resultEl = tray.querySelector('.dice-result')
        if (!resultEl) {
          resultEl = document.createElement('div')
          resultEl.className = 'dice-result'
          tray.insertBefore(resultEl, tray.querySelector('.dice-tray__actions'))
        }
        resultEl.innerHTML = `
          <div class="dice-result__rolls">${current.rolls.map(r => `<span class="die die--spin">${r}</span>`).join('')}</div>
          <div class="dice-result__total">${current.total}</div>
        `
      })
    } catch (err) {
      alert(err.message)
      return
    }
    state.lastDiceResult = result

    // ponytail: si el master finalizó mientras el dado rodaba, la tirada va al
    // último encuentro resuelto en vez de perderse.
    const target = currentEncounter()
      || [...state.game.encounters].reverse().find(e => e.outcome === 'resolved')
    if (target) {
      target.rollHistory.push({
        characterId: state.diceCharacterId || null,
        expression: result.expression,
        result: result.total,
        rolls: result.rolls,
        modifier: result.modifier,
        ts: new Date().toISOString()
      })
      await persistGame()
    }
    paint()
  }

  function wireEncounterEdit() {
    if (!currentEncounter()) return
    for (const field of ['title', 'description']) {
      container.querySelector(`[data-edit-encounter="${field}"]`)
        ?.addEventListener('click', () => beginEncounterEdit(field))
    }
  }

  function beginEncounterEdit(field) {
    const enc = currentEncounter()
    if (!enc) return
    const el = container.querySelector(`[data-edit-encounter="${field}"]`)
    const original = enc[field] || ''
    const isMultiline = field === 'description'

    const input = document.createElement(isMultiline ? 'textarea' : 'input')
    if (!isMultiline) input.type = 'text'
    input.value = original
    input.className = 'encounter-edit__input'
    if (isMultiline) input.rows = 6
    el.replaceWith(input)
    input.focus()
    input.select()

    let done = false
    const finish = async (commit) => {
      if (done) return
      done = true
      if (commit) {
        enc[field] = input.value
        await persistGame()
      }
      paint()
    }
    input.addEventListener('blur', () => finish(true))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !isMultiline) input.blur()
      if (e.key === 'Escape') { input.value = original; input.blur() }
    })
  }

  function beginStatEdit(span) {
    if (span.querySelector('input')) return
    const id = span.dataset.statId
    const stat = span.dataset.statEdit
    const char = state.characters.find(c => c.id === id)
    if (!char) return

    const fieldDef = getSystem(char.system)?.characterSchema.fields.find(f => f.key === stat)
    const current = char.stats[stat]

    const input = document.createElement('input')
    input.type = 'number'
    input.value = current
    input.className = 'stat-edit__input'
    if (fieldDef?.min != null) input.min = fieldDef.min
    if (fieldDef?.max != null) input.max = fieldDef.max

    span.textContent = ''
    span.appendChild(input)
    input.focus()
    input.select()

    let done = false
    const finish = async (commit) => {
      if (done) return
      done = true
      const newVal = Number(input.value)
      span.textContent = Number.isNaN(newVal) ? current : newVal
      if (!commit || Number.isNaN(newVal) || newVal === current) return

      char.stats[stat] = newVal
      try {
        await saveCharacter(char)
      } catch (err) {
        console.error('saveCharacter falló:', err)
        char.stats[stat] = current  // revierte visual y en memoria
        span.textContent = current
      }
    }

    input.addEventListener('blur', () => finish(true))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur()
      if (e.key === 'Escape') { input.value = current; input.blur() }
    })
  }

  async function handleGameAction(action) {
    switch (action) {
      case 'toggle-dice':
        state.showDiceTray = !state.showDiceTray
        state.lastDiceResult = null
        paint()
        break
      case 'finalize': {
        const enc = currentEncounter()
        if (!enc) return
        if (!confirm('¿Finalizar este encuentro?')) return
        enc.outcome = 'resolved'
        enc.resolvedAt = new Date().toISOString()
        state.game.currentEncounterId = null
        await persistGame()
        paint()
        break
      }
      case 'advance-encounter':
        await advanceEncounter()
        break
      case 'finish-game':
        if (!confirm('¿Cerrar la partida? Quedará marcada como finalizada.')) return
        state.game.status = 'finished'
        await persistGame()
        location.hash = '/'
        break
      case 'add-character':
        location.hash = `/character/new/${state.game.system}?returnTo=/game/${state.game.id}`
        break
    }
  }

  async function advanceEncounter() {
    // si hay encuentro activo, cerrarlo
    const enc = currentEncounter()
    if (enc) {
      enc.outcome = 'resolved'
      enc.resolvedAt = new Date().toISOString()
    }

    const templates = state.game.mission?.encounters || []
    const cursor = state.game.missionCursor || 0
    let newEnc

    if (cursor < templates.length) {
      // siguiente encounter del pack
      const t = templates[cursor]
      newEnc = {
        id: newId(),
        type: t.type || 'combat',
        title: t.title || `Encuentro #${state.game.encounters.length + 1}`,
        description: t.description || '',
        outcome: 'pending',
        masterNotes: [
          t.difficulty ? `Dificultad: ${t.difficulty}` : '',
          t.rewards ? `Recompensas: ${t.rewards}` : ''
        ].filter(Boolean).join('\n'),
        rollHistory: [],
        resolvedAt: null
      }
      state.game.missionCursor = cursor + 1
    } else {
      // misión agotada o sin misión: encounter libre
      newEnc = {
        id: newId(),
        type: 'combat',
        title: state.game.mission
          ? `Encuentro libre ${state.game.encounters.length + 1}`
          : `Encuentro #${state.game.encounters.length + 1}`,
        description: '',
        outcome: 'pending',
        masterNotes: '',
        rollHistory: [],
        resolvedAt: null
      }
    }

    state.game.encounters.push(newEnc)
    state.game.currentEncounterId = newEnc.id
    await persistGame()

    // el encounter cambió → su banner necesita otra imagen
    state.encounterImg = await imageFor({
      id: 'encounter-' + newEnc.id,
      title: newEnc.title,
      description: newEnc.description,
      type: newEnc.type,
      system: state.game.system,
      setting: state.game.setting
    })
    paint()
  }

  function currentEncounter() {
    return state.game.encounters.find(e => e.id === state.game.currentEncounterId) || null
  }

  async function persistGame() {
    state.game.updatedAt = new Date().toISOString()
    state.game = await saveGame(state.game)
  }

  paint()
}

async function loadGameCharacters(characterIds) {
  if (!Array.isArray(characterIds) || characterIds.length === 0) return []
  const results = await Promise.all(characterIds.map(id => getCharacter(id)))
  return results.filter(Boolean)
}

function loadPrefs(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

function savePrefs(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify({
      expression: state.diceExpression,
      characterId: state.diceCharacterId
    }))
  } catch { /* localStorage lleno o bloqueado: las prefs son opcionales */ }
}