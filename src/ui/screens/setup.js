// Setup wizard: 3 pasos para crear una partida nueva.
//   1) Sistema + nombre de la partida
//   2) Ambientación
//   3) Personajes (multi-select; permite crear nuevo inline con returnTo)
// Al final crea un Game con status='active' y navega a /game/:id

import { systems, settings, getSystem, getSetting } from '../../modules/index.js'
import { listCharacters, saveGame } from '../../core/storage.js'
import { newId } from '../../core/id.js'
import { escapeHtml } from '../../core/escape.js'

// Sugerencia de ambientación por sistema (pero el usuario puede cambiar)
function defaultSettingFor(systemId) {
  if (systemId === 'dnd5e') return 'fantasy'
  if (systemId === 'cthulhu') return 'horror'
  return ''
}

export async function renderSetup(params, container) {
  // ponytail: estado en memoria; si el usuario recarga, vuelve a empezar.
  // Es un wizard rápido, no compensa persistencia todavía.
  const state = {
    step: 1,
    name: '',
    systemId: '',
    settingId: '',
    selectedCharIds: new Set(),
    characters: await listCharacters()
  }

  function paint() {
    container.innerHTML = renderWizard(state)
    wire()
  }

  function wire() {
    // Step nav
    container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action))
    })
    // System select
    container.querySelectorAll('[data-system]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.systemId = btn.dataset.system
        if (!state.settingId) state.settingId = defaultSettingFor(state.systemId)
        paint()
      })
    })
    // Setting select
    container.querySelectorAll('[data-setting]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.settingId = btn.dataset.setting
        paint()
      })
    })
    // Name input (live, no repaint)
    const nameInput = container.querySelector('[data-name]')
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        state.name = nameInput.value
      })
    }
    // Character checkbox toggle
    container.querySelectorAll('[data-char]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.char
        if (state.selectedCharIds.has(id)) state.selectedCharIds.delete(id)
        else state.selectedCharIds.add(id)
        paint()
      })
    })
  }

  function handleAction(action) {
    if (action === 'next') {
      if (state.step === 1 && state.systemId) {
        state.step = 2
        paint()
      } else if (state.step === 2 && state.settingId) {
        state.step = 3
        paint()
      } else if (state.step === 3) {
        startGame()
      }
    } else if (action === 'back') {
      if (state.step > 1) {
        state.step--
        paint()
      }
    } else if (action === 'create-character') {
      // Volvemos al wizard tras guardar gracias al returnTo
      const url = `/character/new/${state.systemId}?returnTo=/setup`
      location.hash = url
    }
  }

  async function startGame() {
    const system = getSystem(state.systemId)
    const game = {
      id: newId(),
      name: state.name.trim() || `Partida de ${system.name}`,
      system: state.systemId,
      setting: state.settingId,
      status: 'active',
      characters: Array.from(state.selectedCharIds),
      mission: null,
      encounters: [],
      currentEncounterId: null
    }
    const saved = await saveGame(game)
    location.hash = `/game/${saved.id}`
  }

  paint()
}

function renderWizard(state) {
  return `
    <main class="screen setup">
      ${renderStepIndicator(state.step)}
      ${state.step === 1 ? renderStep1(state) : ''}
      ${state.step === 2 ? renderStep2(state) : ''}
      ${state.step === 3 ? renderStep3(state) : ''}
    </main>
  `
}

function renderStepIndicator(current) {
  const labels = ['Sistema', 'Ambientación', 'Personajes']
  return `
    <ol class="setup__steps">
      ${[1, 2, 3].map((n) => `
        <li class="setup__step ${n === current ? 'setup__step--active' : ''} ${n < current ? 'setup__step--done' : ''}">
          <span class="setup__step-num">${n}</span>
          <span class="setup__step-label">${labels[n - 1]}</span>
        </li>
      `).join('')}
    </ol>
  `
}

function renderStep1(state) {
  return `
    <section class="setup__step">
      <h1 class="setup__title">¿Qué sistema?</h1>
      <p class="setup__hint">Elige las reglas que vais a usar.</p>

      <label class="field">
        <span class="field__label">Nombre de la partida (opcional)</span>
        <input type="text" data-name class="field__input" value="${escapeHtml(state.name)}" placeholder="La Mina Perdida, Horrores en Arkham…" />
      </label>

      <div class="setup__options">
        ${systems.map((s) => `
          <button class="setup-option ${state.systemId === s.id ? 'setup-option--selected' : ''}" data-system="${s.id}" type="button">
            <span class="setup-option__name">${escapeHtml(s.name)}</span>
            <span class="setup-option__hint">${escapeHtml(s.characterSchema.fields.length)} campos de personaje</span>
          </button>
        `).join('')}
      </div>

      <div class="setup__nav">
        <button class="btn btn--ghost" data-nav="/" type="button">← Cancelar</button>
        <button class="btn btn--primary" data-action="next" type="button" ${state.systemId ? '' : 'disabled'}>Siguiente →</button>
      </div>
    </section>
  `
}

function renderStep2(state) {
  return `
    <section class="setup__step">
      <h1 class="setup__title">¿Qué ambientación?</h1>
      <p class="setup__hint">Define el tono y el mundo. Puedes cambiarla luego.</p>

      <div class="setup__options">
        ${settings.map((s) => `
          <button class="setup-option ${state.settingId === s.id ? 'setup-option--selected' : ''}" data-setting="${s.id}" type="button">
            <span class="setup-option__name">${escapeHtml(s.name)}</span>
            <span class="setup-option__hint">${escapeHtml(s.tone || '')}</span>
          </button>
        `).join('')}
      </div>

      <div class="setup__nav">
        <button class="btn btn--ghost" data-action="back" type="button">← Atrás</button>
        <button class="btn btn--primary" data-action="next" type="button" ${state.settingId ? '' : 'disabled'}>Siguiente →</button>
      </div>
    </section>
  `
}

function renderStep3(state) {
  const compatible = state.characters.filter((c) => c.system === state.systemId)
  const selected = state.selectedCharIds.size

  let charactersBlock
  if (compatible.length === 0) {
    charactersBlock = `
      <div class="setup__empty">
        <p>No tienes personajes de <strong>${escapeHtml(getSystem(state.systemId).name)}</strong>.</p>
        <button class="btn btn--primary" data-action="create-character" type="button">+ Crear personaje</button>
      </div>
    `
  } else {
    charactersBlock = `
      <ul class="setup__chars">
        ${compatible.map((c) => {
          const isSelected = state.selectedCharIds.has(c.id)
          return `
            <li class="setup-char ${isSelected ? 'setup-char--selected' : ''}" data-char="${c.id}" tabindex="0">
              <span class="setup-char__check" aria-hidden="true">${isSelected ? '✓' : ''}</span>
              <div class="setup-char__body">
                <strong>${escapeHtml(c.name)}</strong>
                <span class="setup-char__meta">HP ${escapeHtml(c.stats.hp)}/${escapeHtml(c.stats.maxHp)}</span>
              </div>
            </li>
          `
        }).join('')}
      </ul>
      <button class="btn btn--ghost" data-action="create-character" type="button">+ Crear otro personaje</button>
    `
  }

  return `
    <section class="setup__step">
      <h1 class="setup__title">¿Quién viene a la partida?</h1>
      <p class="setup__hint">Toca para seleccionar. Mínimo 0 (puedes jugar solo).</p>

      <div class="setup__counter">${selected} seleccionado${selected === 1 ? '' : 's'}</div>

      ${charactersBlock}

      <div class="setup__nav">
        <button class="btn btn--ghost" data-action="back" type="button">← Atrás</button>
        <button class="btn btn--primary" data-action="next" type="button">Iniciar partida</button>
      </div>
    </section>
  `
}
