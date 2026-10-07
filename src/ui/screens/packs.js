// Pantalla de packs de misiones. Lista, importa desde archivo, importa samples, elimina.

import { listPacks, deletePack } from '../../core/storage.js'
import { importPackFromFile, importSamplePacks } from '../../core/packs.js'
import { getSystem, getSetting } from '../../modules/index.js'
import { escapeHtml } from '../../core/escape.js'

export async function renderPacks(params, container) {
  const state = {
    packs: await listPacks(),
    error: null,
    success: null,
    importingSamples: false
  }

  function paint() {
    container.innerHTML = renderView(state)
    wire()
  }

  function wire() {
    container.querySelector('[data-back]')?.addEventListener('click', () => { location.hash = '/' })

    const fileInput = container.querySelector('[data-file-input]')
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
          const pack = await importPackFromFile(file)
          state.success = `Pack "${pack.name}" importado con ${pack.missions.length} misión(es).`
          state.error = null
          state.packs = await listPacks()
        } catch (err) {
          state.error = `Error al importar: ${err.message}`
          state.success = null
        } finally {
          e.target.value = ''
        }
        paint()
      })
    }

    const samplesBtn = container.querySelector('[data-import-samples]')
    if (samplesBtn) {
      samplesBtn.addEventListener('click', async () => {
        if (state.importingSamples) return
        state.importingSamples = true
        paint()
        try {
          const { imported, total, errors } = await importSamplePacks()
          state.packs = await listPacks()
          if (imported === total) {
            state.success = `✓ Importados los ${imported} packs de ejemplo.`
          } else if (imported > 0) {
            state.success = `Importados ${imported} de ${total} packs (${errors.length} fallaron).`
          } else {
            state.error = `No se pudo importar ningún pack. Errores: ${errors.join('; ')}`
          }
          state.error = state.error || (errors.length ? `Algunos fallaron: ${errors.join('; ')}` : state.error)
        } finally {
          state.importingSamples = false
          paint()
        }
      })
    }

    container.querySelectorAll('[data-delete-pack]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deletePack
        const pack = state.packs.find(p => p.id === id)
        if (!confirm(`¿Eliminar el pack "${pack?.name}"? Las partidas ya creadas no se ven afectadas.`)) return
        await deletePack(id)
        state.packs = await listPacks()
        paint()
      })
    })
  }

  paint()
}

function renderView(state) {
  const banner = state.error
    ? `<div class="settings__banner settings__banner--err">${escapeHtml(state.error)}</div>`
    : state.success
      ? `<div class="settings__banner settings__banner--ok">${escapeHtml(state.success)}</div>`
      : ''

  return `
    <main class="screen packs">
      <header class="packs__header">
        <button type="button" class="btn btn--ghost btn--sm" data-back>← Inicio</button>
        <h1>Packs de misiones</h1>
      </header>

      <p class="packs__hint">
        Los packs son ficheros JSON con misiones y encuentros prefabricados.
        Impórtalos aquí para usarlos al crear partidas.
      </p>

      ${banner}

      <div class="packs__import">
        <label class="btn btn--primary packs__import-btn">
          📥 Importar pack (.json)
          <input type="file" data-file-input accept=".json,application/json" hidden />
        </label>
        <button type="button" class="btn btn--ghost packs__import-samples" data-import-samples ${state.importingSamples ? 'disabled' : ''}>
          ${state.importingSamples ? '⏳ Importando…' : '✨ Importar 13 packs de ejemplo'}
        </button>
      </div>

      ${state.packs.length === 0 ? `
        <div class="packs__empty">
          <p>No hay packs importados todavía.</p>
          <p class="packs__empty-hint">Crea un JSON con este formato y luego impórtalo, o usa el botón de arriba para cargar la biblioteca de ejemplo.</p>
          <pre class="packs__schema">{
  "name": "La Mina Perdida",
  "system": "dnd5e",
  "setting": "fantasy",
  "missions": [
    {
      "title": "Investigar la mina",
      "brief": "El pueblo de Robledo pide ayuda...",
      "objectives": ["Encontrar al minero perdido", "Recuperar el artefacto"],
      "encounters": [
        { "type": "combat", "title": "Emboscada en el puente",
          "description": "Tres goblins atacan al amanecer.",
          "difficulty": "medium", "rewards": "20 PO + daga élfica" }
      ]
    }
  ]
}</pre>
        </div>
      ` : `
        <ul class="packs__list">
          ${state.packs.map(renderPackCard).join('')}
        </ul>
      `}
    </main>
  `
}

function renderPackCard(pack) {
  const system = getSystem(pack.system)
  const setting = pack.setting ? getSetting(pack.setting) : null
  const totalEncounters = pack.missions.reduce((s, m) => s + (m.encounters?.length || 0), 0)
  return `
    <li class="pack-card">
      <header class="pack-card__head">
        <h3>${escapeHtml(pack.name)}</h3>
        <button type="button" class="btn btn--ghost btn--sm btn--danger" data-delete-pack="${escapeHtml(pack.id)}">Eliminar</button>
      </header>
      <div class="pack-card__meta">
        <span>${escapeHtml(system?.name || pack.system)}</span>
        ${setting ? `<span>· ${escapeHtml(setting.name)}</span>` : ''}
      </div>
      <div class="pack-card__stats">
        <span>📜 ${pack.missions.length} misión(es)</span>
        <span>⚔️ ${totalEncounters} encuentro(s)</span>
      </div>
    </li>
  `
}
