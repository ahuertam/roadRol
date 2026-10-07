// Galería de personajes. Búsqueda, edición inline de stats vitales,
// y acciones: editar, duplicar, eliminar, exportar.

import { listCharacters, getCharacter, saveCharacter, deleteCharacter } from '../../core/storage.js'
import { getSystem, systems } from '../../modules/index.js'
import { renderCharacterCard } from '../components/characterCard.js'
import { downloadJSON, defaultFilename } from '../../core/importExport.js'
import { escapeHtml } from '../../core/escape.js'

export async function renderGallery(params, container) {
  // Estado de UI vive en este closure
  const state = {
    query: '',
    characters: await listCharacters(),
    systemFilter: ''
  }

  function paint() {
    const q = state.query.toLowerCase().trim()
    const filtered = state.characters.filter(c => {
      if (state.systemFilter && c.system !== state.systemFilter) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q)
        || (c.setting || '').toLowerCase().includes(q)
        || (getSystem(c.system)?.name || '').toLowerCase().includes(q)
    })

    const systemOptions = [
      `<option value="">Todos los sistemas</option>`,
      ...systems.map(s => `<option value="${s.id}" ${state.systemFilter === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
    ].join('')

    container.innerHTML = `
      <main class="screen gallery">
        <header class="gallery__header">
          <h1>Galería de personajes</h1>
          <div class="gallery__filters">
            <label class="visually-hidden" for="gallery-search">Buscar personajes</label>
            <input id="gallery-search" type="search" data-search class="field__input" placeholder="Buscar por nombre…" value="${escapeHtml(state.query)}" aria-label="Buscar personajes" />
            <label class="visually-hidden" for="gallery-system-filter">Filtrar por sistema</label>
            <select id="gallery-system-filter" data-system-filter class="field__input" aria-label="Filtrar por sistema">
              ${systemOptions}
            </select>
          </div>
        </header>

        ${state.characters.length === 0 ? `
          <div class="gallery__empty">
            <p>No tienes personajes todavía.</p>
            <p class="gallery__empty-hint">Crea uno eligiendo un sistema desde "Nueva partida" (fase 4) o vía la consola del navegador.</p>
          </div>
        ` : filtered.length === 0 ? `
          <div class="gallery__empty">
            <p>Nada coincide con tu búsqueda.</p>
          </div>
        ` : `
          <div class="gallery__list">
            ${filtered.map(renderCharacterCard).join('')}
          </div>
        `}
      </main>
    `

    wireFilters()
    wireCards()
  }

  function wireFilters() {
    const search = container.querySelector('[data-search]')
    search.addEventListener('input', () => {
      state.query = search.value
      paint()
      // Mantener foco en el input tras repintar
      const next = container.querySelector('[data-search]')
      if (next) {
        next.focus()
        next.setSelectionRange(state.query.length, state.query.length)
      }
    })
    const filter = container.querySelector('[data-system-filter]')
    filter.addEventListener('change', () => {
      state.systemFilter = filter.value
      paint()
    })
  }

  function wireCards() {
    // Acciones por card (delegación)
    container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id))
    })
    // Edición inline de stats
    container.querySelectorAll('[data-edit-stat]').forEach((el) => {
      el.addEventListener('click', () => beginStatEdit(el))
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          beginStatEdit(el)
        }
      })
    })
  }

  async function handleAction(action, id) {
    const character = state.characters.find(c => c.id === id)
    if (!character) return

    if (action === 'edit') {
      location.hash = `/character/${id}`
    } else if (action === 'duplicate') {
      const copy = {
        ...character,
        id: undefined,
        name: character.name + ' (copia)',
        createdAt: undefined,
        updatedAt: undefined
      }
      await saveCharacter(copy)
      await refresh()
    } else if (action === 'export') {
      downloadJSON(character, defaultFilename(character))
    } else if (action === 'delete') {
      if (!confirm(`¿Eliminar a "${character.name}"? No se puede deshacer.`)) return
      await deleteCharacter(id)
      await refresh()
    }
  }

  function beginStatEdit(span) {
    if (span.querySelector('input')) return  // ya en edición
    const id = span.dataset.id
    const stat = span.dataset.editStat
    const current = span.textContent
    const system = getSystem(state.characters.find(c => c.id === id)?.system)

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
      const newRaw = input.value
      const newVal = Number(newRaw)
      span.textContent = Number.isNaN(newVal) ? current : newVal
      if (commit && !Number.isNaN(newVal) && String(newVal) !== current) {
        const char = await getCharacter(id)
        if (!char) return
        char.stats[stat] = newVal
        await saveCharacter(char)
        // sincronizar estado local
        const local = state.characters.find(c => c.id === id)
        if (local) local.stats[stat] = newVal
      }
    }

    input.addEventListener('blur', () => finish(true))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur()
      if (e.key === 'Escape') { input.value = current; input.blur() }
    })
  }

  async function refresh() {
    state.characters = await listCharacters()
    paint()
  }

  paint()
}
