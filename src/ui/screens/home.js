// Home: lista partidas, continuar la última activa, crear nueva, importar, navegar a galería/packs.

import { listGames, listCharacters, saveGame, deleteGame } from '../../core/storage.js'
import { downloadJSON, readJSONFile } from '../../core/importExport.js'
import { importPackFromJSON } from '../../core/packs.js'
import { getSystem, getSetting } from '../../modules/index.js'
import { imageFor, fallbackGradient } from '../../core/images.js'
import { escapeHtml } from '../../core/escape.js'

function newId() { return crypto.randomUUID() }

function now() { return new Date().toISOString() }

function defaultGameFilename(game) {
  const safe = (game.name || 'partida').toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const stamp = new Date().toISOString().slice(0, 10)
  return `${safe}-${stamp}.json`
}

function formatRelative(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `hace ${d} d`
  return new Date(iso).toLocaleDateString('es')
}

export async function renderHome(params, container) {
  const [games, characters] = await Promise.all([listGames(), listCharacters()])

  // Pre-computar imagen para cada game (cachea library internamente)
  const gameImages = {}
  await Promise.all(games.map(async g => {
    gameImages[g.id] = await imageFor({
      id: g.id,
      name: g.name,
      title: g.name,
      brief: g.mission?.brief || '',
      system: g.system,
      setting: g.setting
    })
  }))

  const state = {
    games,
    characters,
    gameImages,
    importMessage: null
  }

  function paint() {
    container.innerHTML = renderView(state)
    wire()
  }

  function wire() {
    container.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => { location.hash = el.dataset.nav })
    })

    // Eliminar partida
    container.querySelectorAll('[data-action="delete-game"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id
        const game = state.games.find(g => g.id === id)
        if (!confirm(`¿Eliminar la partida "${game?.name}"? Los personajes NO se eliminan.`)) return
        await deleteGame(id)
        state.games = await listGames()
        paint()
      })
    })

    // Exportar partida
    container.querySelectorAll('[data-action="export-game"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        const game = state.games.find(g => g.id === id)
        if (game) downloadJSON(game, defaultGameFilename(game))
      })
    })

    // File picker universal
    const importInput = container.querySelector('[data-import-input]')
    if (importInput) {
      importInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
          await importUniversal(file, state)
        } catch (err) {
          state.importMessage = { type: 'err', text: `Error: ${err.message}` }
        } finally {
          e.target.value = ''
        }
        state.games = await listGames()
        state.characters = await listCharacters()
        // Recomputar imágenes para los nuevos games
        await Promise.all(state.games.map(async g => {
          if (!state.gameImages[g.id]) {
            state.gameImages[g.id] = await imageFor({
              id: g.id, name: g.name, title: g.name,
              brief: g.mission?.brief || '',
              system: g.system, setting: g.setting
            })
          }
        }))
        paint()
      })
    }

    // Borrar mensaje
    container.querySelector('[data-action="dismiss-msg"]')?.addEventListener('click', () => {
      state.importMessage = null
      paint()
    })
  }

  paint()
}

function renderView(state) {
  const activeGames = state.games.filter(g => g.status === 'active')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  const finishedGames = state.games.filter(g => g.status === 'finished')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  const lastGame = activeGames[0]

  const banner = state.importMessage
    ? `<div class="settings__banner settings__banner--${state.importMessage.type === 'err' ? 'err' : 'ok'}">
         ${escapeHtml(state.importMessage.text)}
         <button type="button" class="settings__banner-close" data-action="dismiss-msg" aria-label="Cerrar">×</button>
       </div>`
    : ''

  return `
    <main class="screen home">
      <h1 class="home__title">RoadRol</h1>
      <p class="home__subtitle">Tu director de partidas en el móvil</p>

      ${banner}

      <nav class="home__menu">
        <button class="btn btn--primary" data-nav="/setup">Nueva partida</button>
        <label class="btn home__import-btn">
          📥 Importar (.json)
          <input type="file" data-import-input accept=".json,application/json" hidden />
        </label>
        <button class="btn" data-nav="/gallery">Galería de personajes</button>
        <button class="btn" data-nav="/packs">Packs de misiones</button>
      </nav>

      ${lastGame ? `
        <section class="home__continue">
          <button class="btn btn--primary btn--lg home__continue-btn" data-nav="/game/${escapeHtml(lastGame.id)}">
            ▶ Continuar: ${escapeHtml(lastGame.name)}
          </button>
        </section>
      ` : ''}

      <div data-home-cover-slot></div>

      ${activeGames.length > 0 ? `
        <section class="home__games">
          <h2 class="home__section-title">Partidas activas (${activeGames.length})</h2>
          <ul class="game-list">
            ${activeGames.map(g => renderGameCard(g, state.characters, state.gameImages[g.id])).join('')}
          </ul>
        </section>
      ` : ''}

      ${finishedGames.length > 0 ? `
        <section class="home__games">
          <h2 class="home__section-title">Partidas finalizadas (${finishedGames.length})</h2>
          <ul class="game-list">
            ${finishedGames.map(g => renderGameCard(g, state.characters, state.gameImages[g.id])).join('')}
          </ul>
        </section>
      ` : ''}

      ${activeGames.length === 0 && finishedGames.length === 0 ? `
        <p class="home__hint">Aún no hay partidas. Crea una con "Nueva partida" o importa un JSON.</p>
      ` : ''}
    </main>
  `
}

function renderGameCard(game, allCharacters, img) {
  const system = getSystem(game.system)
  const setting = game.setting ? getSetting(game.setting) : null
  const totalEncounters = (game.encounters || []).length
  const resolvedEncounters = (game.encounters || []).filter(e => e.outcome === 'resolved').length
  const chars = (game.characters || [])
    .map(id => allCharacters.find(c => c.id === id))
    .filter(Boolean)

  // ponytail: img viene pre-computado en renderHome. Si Pollinations falla,
  // el gradient fallback (también en img.gradient) queda visible.
  const gradient = img?.gradient || fallbackGradient(game.id)
  const imageUrl = img?.url || ''

  return `
    <li class="game-list__item">
      <div class="game-list__cover" style="background-image: ${imageUrl ? `url('${escapeHtml(imageUrl)}')` : 'none'}, ${gradient}">
        ${!imageUrl ? `<span class="game-list__cover-icon">${system?.id === 'cthulhu' ? '👁' : '🐉'}</span>` : ''}
      </div>
      <div class="game-list__body">
        <div class="game-list__head">
          <h3 class="game-list__name">${escapeHtml(game.name)}</h3>
          <span class="game-list__date">${formatRelative(game.updatedAt)}</span>
        </div>
        <div class="game-list__meta">
          <span>${escapeHtml(system?.name || game.system)}</span>
          ${setting ? `<span> · ${escapeHtml(setting.name)}</span>` : ''}
          ${game.mission ? `<span> · 📜 ${escapeHtml(game.mission.title || 'misión')}</span>` : '<span> · sin misión</span>'}
        </div>
        <div class="game-list__stats">
          <span>⚔️ ${resolvedEncounters}/${totalEncounters} encuentro(s)</span>
          <span>👥 ${chars.length} personaje(s)</span>
        </div>
        <div class="game-list__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-nav="/game/${escapeHtml(game.id)}">
            ${game.status === 'finished' ? '👁 Ver' : '▶ Continuar'}
          </button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="export-game" data-id="${escapeHtml(game.id)}">💾 Exportar</button>
          <button type="button" class="btn btn--ghost btn--sm btn--danger" data-action="delete-game" data-id="${escapeHtml(game.id)}">🗑 Eliminar</button>
        </div>
      </div>
    </li>
  `
}

// ---- Import universal: detecta por shape (pack / game / character) ----

async function importUniversal(file, state) {
  const raw = await readJSONFile(file)
  const entity = raw?.entity || raw?.pack || raw

  // Pack: tiene "missions"
  if (Array.isArray(entity?.missions)) {
    const pack = await importPackFromJSON(raw)
    state.importMessage = { type: 'ok', text: `✓ Pack "${pack.name}" importado con ${pack.missions.length} misión(es).` }
    return
  }

  // Game: tiene "encounters" + "characters"
  if (Array.isArray(entity?.encounters) && Array.isArray(entity?.characters)) {
    const saved = await importGame(entity)
    state.importMessage = { type: 'ok', text: `✓ Partida "${saved.name}" importada.` }
    return
  }

  // Character: tiene "stats"
  if (entity?.stats && typeof entity.stats === 'object') {
    const { saveCharacter } = await import('../../core/storage.js')
    const saved = await saveCharacter({ ...entity, id: undefined })
    state.importMessage = { type: 'ok', text: `✓ Personaje "${saved.name}" importado.` }
    return
  }

  throw new Error('JSON no reconocido como pack, partida ni personaje')
}

async function importGame(entity) {
  if (!entity.name || typeof entity.name !== 'string') {
    throw new Error('Falta name en la partida')
  }
  if (!getSystem(entity.system)) {
    throw new Error(`Sistema desconocido: "${entity.system}"`)
  }
  if (entity.setting && !getSetting(entity.setting)) {
    throw new Error(`Ambientación desconocida: "${entity.setting}"`)
  }
  if (!Array.isArray(entity.encounters)) {
    throw new Error('Falta encounters (debe ser array)')
  }
  // ponytail: importamos con id nuevo para evitar colisiones
  return saveGame({
    ...entity,
    id: newId(),
    status: entity.status === 'finished' ? 'finished' : 'active',
    characters: Array.isArray(entity.characters) ? entity.characters : [],
    createdAt: entity.createdAt || now(),
    updatedAt: now()
  })
}
