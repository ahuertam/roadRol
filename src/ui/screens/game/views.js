// Renderers puros de la pantalla de partida. Sin estado, sin efectos: reciben
// `state` y devuelven HTML. Separados de game.js por el mismo motivo que
// dice components/: aquí no hay nada que mutar ni cables que conectar.
//
// ponytail: game.js grew a 593 líneas, el doble que cualquier otra pantalla.
// Los ~200 de render se extrajeron aquí sin cambiar una línea de lógica.

import { getSystem, getSetting } from '../../../modules/index.js'
import { renderDiceTray } from '../../components/diceTray.js'
import { escapeHtml } from '../../../core/escape.js'

const TYPE_ICONS = { combat: '⚔️', puzzle: '🧩', trap: '⚠️', conversation: '💬', discovery: '🔍' }
const TYPE_LABELS = { combat: 'Combate', puzzle: 'Puzzle', trap: 'Trampa', conversation: 'Conversación', discovery: 'Hallazgo' }

// Vital secundario por sistema (AC para D&D, SAN para CoC)
function secondaryVital(systemId) {
  if (systemId === 'dnd5e') return { key: 'ac', label: 'CA' }
  if (systemId === 'cthulhu') return { key: 'san', label: 'SAN' }
  return null
}

// Estilo de banner: imagen de library/dynamic si existe, si no el gradient.
function bannerStyle(img) {
  return img?.url
    ? `background-image: url('${escapeHtml(img.url)}'), ${img.gradient}`
    : `background: ${img?.gradient || 'transparent'}`
}

export function renderView(state) {
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
          ${enc ? renderEncounter(state, enc) : renderNoEncounter(state)}
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
  const imgStyle = bannerStyle(state.missionImg)
  const title = m?.title ? escapeHtml(m.title) : 'Misión'

  const body = m && state.showMission ? `
    <div class="game__mission-body">
      <p>${escapeHtml(m.brief || '')}</p>
      ${m.objectives?.length ? `
        <ul class="game__objectives">
          ${m.objectives.map(o => `<li>${escapeHtml(o)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  ` : ''

  const empty = !m && state.showMission ? `
    <div class="game__mission-body">
      <p class="game__empty-hint">No hay misión definida.</p>
    </div>
  ` : ''

  return `
    <section class="game__mission">
      <div class="game__mission-banner" style="${imgStyle}">
        <button type="button" class="game__mission-toggle" data-toggle-mission>
          <span>📜 ${title}</span><span>${state.showMission ? '▼' : '▶'}</span>
        </button>
      </div>
      ${body}${empty}
    </section>
  `
}

function renderEncounter(state, enc) {
  return `
    <article class="encounter" data-encounter-id="${escapeHtml(enc.id)}">
      <div class="encounter__banner" style="${bannerStyle(state.encounterImg)}">
        <div class="encounter__head">
          <span class="encounter__type">${TYPE_ICONS[enc.type] || '•'} ${escapeHtml(TYPE_LABELS[enc.type] || enc.type)}</span>
          ${enc.outcome === 'resolved' ? '<span class="encounter__resolved">✓ Resuelto</span>' : ''}
        </div>
        <h2 class="encounter__title" data-edit-encounter="title" tabindex="0" role="button" title="Click para editar">${escapeHtml(enc.title)}</h2>
      </div>
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
  const remaining = Math.max(0, templates.length - (state.game.missionCursor || 0))
  const label = state.game.mission
    ? `Siguiente encuentro${remaining ? ` (quedan ${remaining} de la misión)` : ' — misión agotada, será libre'}`
    : 'Siguiente encuentro (sin misión, será libre)'

  return `
    <div class="encounter encounter--empty">
      <h2 class="encounter__title">Sin encuentro activo</h2>
      <p class="encounter__description">${state.game.mission
        ? 'Misión en curso. Avanza cuando los PJs estén listos.'
        : 'No hay misión definida. Puedes crear encuentros libres sobre la marcha.'}</p>
      <div class="encounter__actions">
        <button type="button" class="btn btn--primary" data-game-action="advance-encounter">▶ ${escapeHtml(label)}</button>
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
          <span class="stat-edit" data-stat-edit="${vital.key}" data-stat-id="${escapeHtml(char.id)}" tabindex="0" role="button" title="Click para editar">${escapeHtml(char.stats[vital.key] ?? '-')}</span>
        </span>
        ` : ''}
      </div>
    </li>
  `
}

function renderFeed(state) {
  const enc = state.game.encounters.find(e => e.id === state.game.currentEncounterId)
  const rolls = enc ? enc.rollHistory.slice().reverse() : []

  if (rolls.length === 0) {
    return `
      <section class="game__panel">
        <h3 class="game__panel-title">Tiradas${enc ? ` (${enc.rollHistory.length})` : ''}</h3>
        <p class="game__empty-hint">${enc ? 'Sin tiradas aún.' : 'No hay encuentro activo.'}</p>
      </section>
    `
  }

  return `
    <section class="game__panel">
      <h3 class="game__panel-title">Tiradas (${enc.rollHistory.length})</h3>
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
    </section>
  `
}