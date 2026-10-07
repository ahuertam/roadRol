// Pantalla principal de partida (master). Single-device para fase 5;
// en fase 9 añadimos sincronización P2P con PeerJS sin cambiar la estructura.
//
// Estado:
//   - game: el objeto Game de IndexedDB
//   - characters: Personajes[] resueltos desde game.characters
//   - lastDiceResult: para mostrar en la bandeja de datos
//   - showDiceTray, showMission: UI local
//
// game.mission (opcional) trae una mission del pack con su lista de
// encounterTemplates. Al pulsar "Siguiente encuentro" se clona el siguiente
// template como game encounter; cuando se agotan, se crean blancos.

import { getGame, saveGame, getCharacter, saveCharacter } from '../../core/storage.js'
import { getSystem, getSetting } from '../../modules/index.js'
import { rollAnimated } from '../../core/dice.js'
import { newId } from '../../core/id.js'
import { renderDiceTray } from '../components/diceTray.js'
import { escapeHtml } from '../../core/escape.js'

// Vital secundario por sistema (AC para D&D, SAN para CoC)
function secondaryVital(systemId) {
  if (systemId === 'dnd5e') return { key: 'ac', label: 'CA' }
  if (systemId === 'cthulhu') return { key: 'san', label: 'SAN' }
  return null
}

export async function renderGame(params, container) {
  const game = await getGame(params.id)
  if (!game) {
    container.innerHTML = `<main class="screen placeholder">Partida no encontrada.<br><br><button class="btn btn--ghost" data-nav="/">← Inicio</button></main>`
    return
  }

  const characters = await loadGameCharacters(game.characters)

  // ponytail: recuerda la última expresión y personaje usado por game.id,
  // para no resetear a '1d20' cada vez que el master navega fuera y vuelve.
  const prefsKey = `roadrol.game.${game.id}.dicePrefs`
  const loadPrefs = () => {
    try { return JSON.parse(localStorage.getItem(prefsKey) || '{}') } catch { return {} }
  }
  const savePrefs = () => {
    try {
      localStorage.setItem(prefsKey, JSON.stringify({
        expression: state.diceExpression,
        characterId: state.diceCharacterId
      }))
    } catch { /* ignorar */ }
  }
  const savedPrefs = loadPrefs()

  const state = {
    game,
    characters,
    showMission: true,
    showDiceTray: false,
    diceExpression: savedPrefs.expression || '1d20',
    diceCharacterId: savedPrefs.characterId || '',
    lastDiceResult: null
  }

  function paint() {
    container.innerHTML = renderView(state)
    wire()
  }

  function wire() {
    // Toggle misión
    container.querySelector('[data-toggle-mission]')?.addEventListener('click', () => {
      state.showMission = !state.showMission
      paint()
    })

    // Acciones del encuentro
    container.querySelectorAll('[data-game-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleGameAction(btn.dataset.gameAction))
    })

    // Edición inline de título y descripción del encuentro
    wireEncounterEdit()

    // Edición inline de stats de personajes
    container.querySelectorAll('[data-stat-edit]').forEach((el) => {
      el.addEventListener('click', () => beginStatEdit(el))
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          beginStatEdit(el)
        }
      })
    })

    // Bandeja de dados
    const tray = container.querySelector('[data-dice-tray]')
    if (tray) {
      const exprInput = tray.querySelector('[data-dice-expr]')
      exprInput.addEventListener('input', () => { state.diceExpression = exprInput.value; savePrefs() })
      const charSelect = tray.querySelector('[data-dice-character]')
      charSelect.addEventListener('change', () => { state.diceCharacterId = charSelect.value; savePrefs() })
      tray.querySelectorAll('[data-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.diceExpression = btn.dataset.preset
          savePrefs()
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
      exprInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doRoll() }
      })
    }
  }

  async function doRoll() {
    let result
    try {
      result = await rollAnimated(state.diceExpression, 500, (current) => {
        // Actualización en vivo del resultado mientras dura la animación
        const tray = container.querySelector('[data-dice-tray]')
        if (!tray) return
        let resultEl = tray.querySelector('.dice-result')
        if (!resultEl) {
          resultEl = document.createElement('div')
          resultEl.className = 'dice-result'
          const actions = tray.querySelector('.dice-tray__actions')
          tray.insertBefore(resultEl, actions)
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

    // Añadir al historial del encuentro actual (o del último resuelto si ya no hay activo)
    // ponytail: si el master finalizó mientras el dado rodaba, no perdemos la tirada.
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
    const enc = currentEncounter()
    if (!enc) return
    const titleEl = container.querySelector('[data-edit-encounter="title"]')
    if (titleEl) {
      titleEl.addEventListener('click', () => beginEncounterEdit('title'))
    }
    const descEl = container.querySelector('[data-edit-encounter="description"]')
    if (descEl) {
      descEl.addEventListener('click', () => beginEncounterEdit('description'))
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
      const val = input.value
      if (commit) {
        enc[field] = val
        enc.id = enc.id // keep id stable
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

    const system = getSystem(char.system)
    const current = char.stats[stat]
    const input = document.createElement('input')
    input.type = 'number'
    input.value = current
    input.className = 'stat-edit__input'
    const fieldDef = system?.characterSchema.fields.find(f => f.key === stat)
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
      if (commit && !Number.isNaN(newVal) && newVal !== current) {
        char.stats[stat] = newVal
        try {
          await saveCharacter(char)
        } catch (err) {
          console.error('saveCharacter falló:', err)
          // revertir visual
          char.stats[stat] = current
          span.textContent = current
        }
      }
    }

    input.addEventListener('blur', () => finish(true))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur()
      if (e.key === 'Escape') { input.value = current; input.blur() }
    })
  }

  async function handleGameAction(action) {
    if (action === 'toggle-dice') {
      state.showDiceTray = !state.showDiceTray
      state.lastDiceResult = null
      paint()
    } else if (action === 'finalize') {
      const enc = currentEncounter()
      if (!enc) return
      if (!confirm('¿Finalizar este encuentro?')) return
      enc.outcome = 'resolved'
      enc.resolvedAt = new Date().toISOString()
      state.game.currentEncounterId = null
      await persistGame()
      paint()
    } else if (action === 'advance-encounter') {
      await advanceEncounter()
    } else if (action === 'finish-game') {
      if (!confirm('¿Cerrar la partida? Quedará marcada como finalizada.')) return
      state.game.status = 'finished'
      await persistGame()
      location.hash = '/'
    } else if (action === 'add-character') {
      location.hash = `/character/new/${state.game.system}?returnTo=/game/${state.game.id}`
    }
  }

  async function advanceEncounter() {
    // 1) Si hay encuentro activo, marcarlo como resuelto
    const enc = currentEncounter()
    if (enc) {
      enc.outcome = 'resolved'
      enc.resolvedAt = new Date().toISOString()
    }
    // 2) Generar el siguiente desde el template de la misión, o blank
    const templates = state.game.mission?.encounters || []
    const cursor = state.game.missionCursor || 0
    let newEnc
    if (cursor < templates.length) {
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

// ============== Render ==============

function renderView(state) {
  const system = getSystem(state.game.system)
  const setting = getSetting(state.game.setting)
  const enc = state.game.encounters.find(e => e.id === state.game.currentEncounterId)

  return `
    <main class="screen game">
      <header class="game__header">
        <button type="button" class="btn btn--ghost btn--sm" data-nav="/">← Inicio</button>
        <div class="game__title">
          <h1>${escapeHtml(state.game.name)}</h1>
          <span class="game__meta">${escapeHtml(system?.name || '')} · ${escapeHtml(setting?.name || '')}</span>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" data-game-action="finish-game">Cerrar</button>
      </header>

      ${renderMission(state)}

      <div class="game__body">
        <section class="game__main">
          ${enc ? renderEncounter(state, enc, system) : renderNoEncounter(state)}
        </section>
        <aside class="game__sidebar">
          ${renderCharacters(state)}
          ${renderFeed(state)}
        </aside>
      </div>
    </main>
  `
}

function renderMission(state) {
  const m = state.game.mission
  if (!m) {
    return `
      <section class="game__mission">
        <button type="button" class="game__mission-toggle" data-toggle-mission>
          <span>📜 Misión</span><span>${state.showMission ? '▼' : '▶'}</span>
        </button>
        ${state.showMission ? `
          <div class="game__mission-body">
            <p class="game__empty-hint">No hay misión definida. (Llegará en fase 7: generación con IA.)</p>
          </div>
        ` : ''}
      </section>
    `
  }
  return `
    <section class="game__mission">
      <button type="button" class="game__mission-toggle" data-toggle-mission>
        <span>📜 ${escapeHtml(m.title || 'Misión')}</span><span>${state.showMission ? '▼' : '▶'}</span>
      </button>
      ${state.showMission ? `
        <div class="game__mission-body">
          <p>${escapeHtml(m.brief || '')}</p>
          ${m.objectives?.length ? `
            <ul class="game__objectives">
              ${m.objectives.map(o => `<li>${escapeHtml(o)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      ` : ''}
    </section>
  `
}

function renderEncounter(state, enc, system) {
  const typeIcons = { combat: '⚔️', puzzle: '🧩', trap: '⚠️', conversation: '💬', discovery: '🔍' }
  const typeLabels = { combat: 'Combate', puzzle: 'Puzzle', trap: 'Trampa', conversation: 'Conversación', discovery: 'Hallazgo' }
  return `
    <article class="encounter" data-encounter-id="${escapeHtml(enc.id)}">
      <div class="encounter__head">
        <span class="encounter__type">${typeIcons[enc.type] || '•'} ${escapeHtml(typeLabels[enc.type] || enc.type)}</span>
        ${enc.outcome === 'resolved' ? '<span class="encounter__resolved">✓ Resuelto</span>' : ''}
      </div>
      <h2 class="encounter__title" data-edit-encounter="title" tabindex="0" role="button" title="Click para editar">${escapeHtml(enc.title)}</h2>
      <p class="encounter__description" data-edit-encounter="description" tabindex="0" role="button" title="Click para editar">${escapeHtml(enc.description || '(sin descripción — click para editar)')}</p>

      ${state.showDiceTray ? renderDiceTray({
        characters: state.characters,
        expression: state.diceExpression,
        characterId: state.diceCharacterId,
        lastResult: state.lastDiceResult
      }) : ''}

      <div class="encounter__actions">
        <button type="button" class="btn btn--primary" data-game-action="toggle-dice">🎲 Tirar dados</button>
        <button type="button" class="btn btn--ghost" data-game-action="finalize">✅ Finalizar</button>
      </div>
    </article>
  `
}

function renderNoEncounter(state) {
  const templates = state.game.mission?.encounters || []
  const cursor = state.game.missionCursor || 0
  const remaining = Math.max(0, templates.length - cursor)
  const missionLabel = state.game.mission
    ? `Siguiente encuentro${remaining ? ` (quedan ${remaining} de la misión)` : ' — misión agotada, será libre'}`
    : 'Siguiente encuentro (sin misión, será libre)'
  return `
    <div class="encounter encounter--empty">
      <h2 class="encounter__title">Sin encuentro activo</h2>
      <p class="encounter__description">${state.game.mission
        ? 'Misión en curso. Avanza cuando los PJs estén listos.'
        : 'No hay misión definida. Puedes crear encuentros libres sobre la marcha.'}</p>
      <div class="encounter__actions">
        <button type="button" class="btn btn--primary" data-game-action="advance-encounter">▶ ${escapeHtml(missionLabel)}</button>
      </div>
    </div>
  `
}

function renderCharacters(state) {
  if (state.characters.length === 0) {
    return `
      <section class="game__panel">
        <h3 class="game__panel-title">Personajes</h3>
        <p class="game__empty-hint">No hay personajes en la partida.</p>
        <button type="button" class="btn btn--ghost btn--sm" data-game-action="add-character">+ Añadir personaje</button>
      </section>
    `
  }
  return `
    <section class="game__panel">
      <h3 class="game__panel-title">Personajes (${state.characters.length})</h3>
      <ul class="game__chars">
        ${state.characters.map(c => renderCharRow(c, state.game.system)).join('')}
      </ul>
      <button type="button" class="btn btn--ghost btn--sm" data-game-action="add-character">+ Añadir</button>
    </section>
  `
}

function renderCharRow(char, systemId) {
  const vital = secondaryVital(systemId)
  const vitalValue = vital ? char.stats[vital.key] ?? '-' : null
  return `
    <li class="game-char">
      <div class="game-char__name">${escapeHtml(char.name)}</div>
      <div class="game-char__stats">
        <span class="game-char__stat">
          <span class="game-char__stat-label">HP</span>
          <span class="stat-edit" data-stat-edit="hp" data-stat-id="${escapeHtml(char.id)}" tabindex="0" role="button" title="Click para editar">${escapeHtml(char.stats.hp ?? '-')}</span>
          <span>/</span>
          <span class="stat-edit" data-stat-edit="maxHp" data-stat-id="${escapeHtml(char.id)}" tabindex="0" role="button" title="Click para editar">${escapeHtml(char.stats.maxHp ?? '-')}</span>
        </span>
        ${vital ? `
        <span class="game-char__stat">
          <span class="game-char__stat-label">${escapeHtml(vital.label)}</span>
          <span class="stat-edit" data-stat-edit="${vital.key}" data-stat-id="${escapeHtml(char.id)}" tabindex="0" role="button" title="Click para editar">${escapeHtml(vitalValue)}</span>
        </span>
        ` : ''}
      </div>
    </li>
  `
}

function renderFeed(state) {
  const enc = state.game.encounters.find(e => e.id === state.game.currentEncounterId)
  const rolls = enc ? enc.rollHistory.slice().reverse() : []
  return `
    <section class="game__panel">
      <h3 class="game__panel-title">Tiradas${enc ? ` (${enc.rollHistory.length})` : ''}</h3>
      ${rolls.length === 0 ? `
        <p class="game__empty-hint">${enc ? 'Sin tiradas aún.' : 'No hay encuentro activo.'}</p>
      ` : `
        <ul class="game__feed">
          ${rolls.map(r => {
            const char = r.characterId ? state.characters.find(c => c.id === r.characterId) : null
            const who = char ? char.name : 'NPC'
            const time = new Date(r.ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
            return `
              <li class="game__feed-item">
                <span class="game__feed-who">${escapeHtml(who)}</span>
                <span class="game__feed-expr">${escapeHtml(r.expression)}</span>
                <span class="game__feed-result">${escapeHtml(r.result)}</span>
                <span class="game__feed-time">${escapeHtml(time)}</span>
              </li>
            `
          }).join('')}
        </ul>
      `}
    </section>
  `
}
