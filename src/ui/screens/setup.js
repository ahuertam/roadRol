// Setup wizard: 4 pasos para crear una partida nueva.
//   1) Sistema + nombre de la partida
//   2) Ambientación
//   3) Misión (de packs importados, o "Sin misión")
//   4) Personajes (multi-select; permite crear nuevo inline con returnTo)
//
// Al final crea un Game con status='active' y navega a /game/:id.
//
// ponytail: el estado se persiste en sessionStorage para que volver de
// /character/new no obligue a repetir selecciones.

import { systems, settings, getSystem, getSetting } from '../../modules/index.js'
import { listCharacters, listPacks, saveGame } from '../../core/storage.js'
import { importSamplePacks } from '../../core/packs.js'
import { newId } from '../../core/id.js'
import { escapeHtml } from '../../core/escape.js'

const STORAGE_KEY = 'roadrol.setupWizard'

function defaultSettingFor(systemId) {
  if (systemId === 'dnd5e') return 'fantasy'
  if (systemId === 'cthulhu') return 'horror'
  return ''
}

// Estado serializable para sessionStorage (Set no se serializa)
function loadStoredState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return {
      step: data.step || 1,
      name: data.name || '',
      systemId: data.systemId || '',
      settingId: data.settingId || '',
      missionId: data.missionId || '',
      selectedCharIds: new Set(data.selectedCharIds || [])
    }
  } catch { return null }
}

function saveStoredState(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      step: state.step,
      name: state.name,
      systemId: state.systemId,
      settingId: state.settingId,
      missionId: state.missionId,
      selectedCharIds: Array.from(state.selectedCharIds)
    }))
  } catch { /* sessionStorage no disponible, YAGNI */ }
}

function clearStoredState() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* */ }
}

export async function renderSetup(params, container) {
  const [characters, packs] = await Promise.all([listCharacters(), listPacks()])
  const stored = loadStoredState()

  const state = stored || {
    step: 1,
    name: '',
    systemId: '',
    settingId: '',
    missionId: '',
    selectedCharIds: new Set(),
    characters,
    packs
  }
  // Si recargamos desde storage, refrescamos characters y packs
  state.characters = characters
  state.packs = packs

  // ponytail: filtra IDs huérfanos (personajes eliminados entre sesiones)
  const validIds = new Set(characters.map(c => c.id))
  for (const id of Array.from(state.selectedCharIds)) {
    if (!validIds.has(id)) state.selectedCharIds.delete(id)
  }

  // Auto-seleccionar personaje recién creado si viene en ?selectChar=
  const newCharId = params?.query?.get('selectChar')
  if (newCharId && validIds.has(newCharId)) {
    state.selectedCharIds.add(newCharId)
    // Si volvía del paso 4 creando un char, vuelve al paso 4
    if (state.step < 4 && state.systemId && state.settingId) state.step = 4
  }

  function persist() { saveStoredState(state) }

  // ponytail: limpia sessionStorage cuando el usuario sale del wizard (excepto a /character/new)
  const onHashChange = () => {
    const path = location.hash.slice(1).split('?')[0]
    if (path !== '/setup' && !path.startsWith('/character/new')) {
      clearStoredState()
    }
  }
  window.addEventListener('hashchange', onHashChange)

  function paint() {
    container.innerHTML = renderWizard(state)
    wire()
    persist()
  }

  function wire() {
    container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action))
    })
    container.querySelectorAll('[data-system]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.systemId = btn.dataset.system
        if (!state.settingId) state.settingId = defaultSettingFor(state.systemId)
        state.missionId = ''  // reset mission al cambiar sistema
        paint()
      })
    })
    container.querySelectorAll('[data-setting]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.settingId = btn.dataset.setting
        paint()
      })
    })
    container.querySelectorAll('[data-mission]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.missionId = btn.dataset.mission
        paint()
      })
    })
    const nameInput = container.querySelector('[data-name]')
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        state.name = nameInput.value
        persist()
      })
    }
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
      if (state.step === 1 && state.systemId) { state.step = 2; paint() }
      else if (state.step === 2 && state.settingId) { state.step = 3; paint() }
      else if (state.step === 3) { state.step = 4; paint() }
      else if (state.step === 4) { startGame() }
    } else if (action === 'back') {
      if (state.step > 1) { state.step--; paint() }
    } else if (action === 'create-character') {
      const url = `/character/new/${state.systemId}?returnTo=/setup`
      location.hash = url
    } else if (action === 'import-samples') {
      importSamplePacks().then(({ imported, total }) => {
        state.packs = state.packs.concat()  // forzar refresh
        return listPacks()
      }).then(packs => {
        state.packs = packs
        paint()
      })
    }
  }

  async function startGame() {
    const system = getSystem(state.systemId)
    const mission = resolveMission(state.missionId)
    const game = {
      id: newId(),
      name: state.name.trim() || `Partida de ${system.name}`,
      system: state.systemId,
      setting: state.settingId,
      status: 'active',
      characters: Array.from(state.selectedCharIds),
      mission,
      missionCursor: 0,
      encounters: [],
      currentEncounterId: null
    }
    clearStoredState()
    const saved = await saveGame(game)
    location.hash = `/game/${saved.id}`
  }

  function resolveMission(missionRef) {
    if (!missionRef) return null
    // missionRef es `${packId}:${missionIndex}` o vacío
    const [packId, idxStr] = missionRef.split(':')
    const pack = state.packs.find(p => p.id === packId)
    if (!pack) return null
    const mission = pack.missions[Number(idxStr)]
    if (!mission) return null
    return {
      title: mission.title,
      brief: mission.brief || '',
      objectives: mission.objectives || [],
      encounters: (mission.encounters || []).map(e => ({ ...e })),
      sourcePackId: packId,
      sourceMissionId: mission.id
    }
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
      ${state.step === 4 ? renderStep4(state) : ''}
    </main>
  `
}

function renderStepIndicator(current) {
  const labels = ['Sistema', 'Ambientación', 'Misión', 'Personajes']
  return `
    <ol class="setup__steps">
      ${[1, 2, 3, 4].map((n) => `
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
        <button class="btn btn--ghost" type="button" data-nav="/">🏠 Inicio</button>
        <button class="btn btn--ghost" data-action="back" type="button">← Atrás</button>
        <button class="btn btn--primary" data-action="next" type="button" ${state.settingId ? '' : 'disabled'}>Siguiente →</button>
      </div>
    </section>
  `
}

function renderStep3(state) {
  // Filtrar packs por sistema y setting
  const availableMissions = []
  for (const pack of state.packs) {
    if (pack.system !== state.systemId) continue
    if (state.settingId && pack.setting && pack.setting !== state.settingId) continue
    pack.missions.forEach((m, idx) => {
      availableMissions.push({ pack, mission: m, ref: `${pack.id}:${idx}` })
    })
  }

  return `
    <section class="setup__step">
      <h1 class="setup__title">¿Qué misión?</h1>
      <p class="setup__hint">Elige una misión de tus packs importados o juega sin misión (encuentros libres).</p>

      <div class="setup__options">
        <button class="setup-option ${state.missionId === '' ? 'setup-option--selected' : ''}" data-mission="" type="button">
          <span class="setup-option__name">🎲 Sin misión</span>
          <span class="setup-option__hint">Encuentros libres, tú diriges sobre la marcha</span>
        </button>
        ${renderMissionOptions(availableMissions, state.missionId)}
      </div>

      ${availableMissions.length === 0 ? `
        <div class="setup__empty">
          <p>No hay misiones de <strong>${escapeHtml(getSystem(state.systemId)?.name || state.systemId)}</strong> en tus packs.</p>
          <p class="setup__empty-hint">Importa un pack que coincida con este sistema, o juega sin misión.</p>
          <div class="setup__empty-actions">
            <button type="button" class="btn btn--primary" data-action="import-samples">✨ Cargar 13 packs de ejemplo</button>
            <button type="button" class="btn btn--ghost" data-nav="/packs">📥 Ir a Packs</button>
          </div>
          ${renderAvailablePacksList(state.packs, state.systemId, state.settingId)}
        </div>
      ` : ''}

      <div class="setup__nav">
        <button class="btn btn--ghost" type="button" data-nav="/">🏠 Inicio</button>
        <button class="btn btn--ghost" data-action="back" type="button">← Atrás</button>
        <button class="btn btn--primary" data-action="next" type="button">Siguiente →</button>
      </div>
    </section>
  `
}

function renderMissionOptions(list, currentRef) {
  return list.map(({ pack, mission, ref }) => `
    <button class="setup-option ${currentRef === ref ? 'setup-option--selected' : ''}" data-mission="${escapeHtml(ref)}" type="button">
      <span class="setup-option__name">${escapeHtml(mission.title)}</span>
      <span class="setup-option__hint">${escapeHtml(pack.name)} · ${mission.encounters?.length || 0} encuentro(s)</span>
    </button>
  `).join('')
}

function renderStep4(state) {
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
        <button class="btn btn--ghost" type="button" data-nav="/">🏠 Inicio</button>
        <button class="btn btn--ghost" data-action="back" type="button">← Atrás</button>
        <button class="btn btn--primary" data-action="next" type="button">Iniciar partida</button>
      </div>
    </section>
  `
}

// ponytail: lista los packs que el user SÍ tiene, aunque no matcheen
// el system/setting. Le ayuda a entender por qué no ve misiones.
function renderAvailablePacksList(allPacks, systemId, settingId) {
  if (allPacks.length === 0) return ''
  const groups = { match: [], otherSystem: [], otherSetting: [] }
  for (const pack of allPacks) {
    const sysMatch = pack.system === systemId
    const setMatch = !settingId || !pack.setting || pack.setting === settingId
    if (sysMatch && setMatch) groups.match.push(pack)
    else if (!sysMatch) groups.otherSystem.push(pack)
    else groups.otherSetting.push(pack)
  }
  const renderItem = (pack) => {
    const sys = getSystem(pack.system)
    const set = pack.setting ? getSetting(pack.setting) : null
    return `<li class="setup__pack-item">${escapeHtml(pack.name)} <span class="setup__pack-meta">${escapeHtml(sys?.name || pack.system)}${set ? ' · ' + escapeHtml(set.name) : ''}</span></li>`
  }
  return `
    <details class="setup__packs-debug">
      <summary>Tus packs importados (${allPacks.length})</summary>
      <ul class="setup__packs-list">
        ${groups.match.length ? `<li class="setup__packs-section">✓ Matchean este sistema/setting:</li>${groups.match.map(renderItem).join('')}` : ''}
        ${groups.otherSetting.length ? `<li class="setup__packs-section">⚠ Mismo sistema, otra ambientación:</li>${groups.otherSetting.map(renderItem).join('')}` : ''}
        ${groups.otherSystem.length ? `<li class="setup__packs-section">✕ Otro sistema:</li>${groups.otherSystem.map(renderItem).join('')}` : ''}
      </ul>
    </details>
  `
}
