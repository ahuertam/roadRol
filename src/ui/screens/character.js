// Pantalla de personaje: nuevo (`#/character/new/:system`) o editar (`#/character/:id`).
// Edición libre: el usuario puede teclear cualquier valor, la validación es visual.
// Solo bloqueamos el submit si la validación final falla.

import { getSystem } from '../../modules/index.js'
import { getCharacter, saveCharacter } from '../../core/storage.js'
import { renderCharacterForm } from '../components/characterForm.js'
import { escapeHtml } from '../../core/escape.js'

export async function renderCharacterNew(params, container) {
  const system = getSystem(params.system)
  if (!system) {
    const back = escapeHtml(params.query?.get('returnTo') || '/gallery')
    container.innerHTML = `<main class="screen placeholder">Sistema "${escapeHtml(params.system)}" no existe.<br><br><button class="btn btn--ghost" data-nav="${back}">← Volver</button></main>`
    return
  }
  const returnTo = params.query?.get('returnTo') || '/gallery'
  mount(container, {
    title: 'Nuevo personaje',
    system,
    systemId: params.system,
    draft: {
      id: null,
      name: '',
      setting: '',
      stats: { ...system.defaultStats() },
      notes: ''
    },
    isEdit: false,
    returnTo
  })
}

export async function renderCharacterEdit(params, container) {
  const character = await getCharacter(params.id)
  if (!character) {
    container.innerHTML = `<main class="screen placeholder">Personaje no encontrado.<br><br><button class="btn btn--ghost" data-nav="/gallery">← Galería</button></main>`
    return
  }
  const system = getSystem(character.system)
  if (!system) {
    container.innerHTML = `<main class="screen placeholder">Sistema "${escapeHtml(character.system)}" desconocido.<br><br><button class="btn btn--ghost" data-nav="/gallery">← Galería</button></main>`
    return
  }
  mount(container, {
    title: 'Editar personaje',
    system,
    systemId: character.system,
    draft: character,
    isEdit: true,
    returnTo: '/gallery'
  })
}

function mount(container, ctx) {
  const backLabel = ctx.returnTo === '/setup' ? '← Setup' : '← Galería'
  container.innerHTML = `
    <main class="screen character">
      <header class="character__header">
        <button type="button" class="btn btn--ghost btn--sm" data-nav="${escapeHtml(ctx.returnTo)}">${backLabel}</button>
        <h1 class="character__title">${escapeHtml(ctx.title)}</h1>
        <span class="character__system">${escapeHtml(ctx.system.name)}</span>
      </header>
      ${renderCharacterForm({ draft: ctx.draft, system: ctx.system, isEdit: ctx.isEdit, returnTo: ctx.returnTo })}
    </main>
  `
  wireForm(container, ctx)
}

function wireForm(container, ctx) {
  const form = container.querySelector('[data-form]')

  // Validación en vivo por stat — marca error visual pero no bloquea tipeo
  form.querySelectorAll('input[name^="stats."]').forEach((input) => {
    input.addEventListener('input', () => validateField(input, ctx.system))
    input.addEventListener('blur', () => validateField(input, ctx.system))
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(form)

    const stats = {}
    for (const f of ctx.system.characterSchema.fields) {
      const raw = fd.get(`stats.${f.key}`)
      const n = Number(raw)
      stats[f.key] = Number.isNaN(n) ? 0 : n
    }

    const character = {
      id: ctx.draft.id || undefined,
      name: String(fd.get('name') || '').trim(),
      system: ctx.systemId,
      setting: String(fd.get('setting') || ''),
      stats,
      notes: String(fd.get('notes') || '')
    }

    // Validación final: bloqueamos si algo falla para no guardar basura
    const result = ctx.system.validateCharacter(character)
    if (!result.ok) {
      showFormErrors(form, result.errors)
      return
    }

    try {
      const saved = await saveCharacter(character)
      // ponytail: si volvemos al wizard, le pasamos el id por query para auto-seleccionar
      if (ctx.returnTo === '/setup' && saved?.id) {
        location.hash = `${ctx.returnTo}?selectChar=${encodeURIComponent(saved.id)}`
      } else {
        location.hash = ctx.returnTo
      }
    } catch (err) {
      // No navegamos: el usuario no pierde lo que llevaba escrito
      console.error('saveCharacter falló:', err)
      showFormErrors(form, [`No se pudo guardar (${err.name || 'Error'}). Comprueba el espacio disponible y vuelve a intentarlo.`])
    }
  })
}

function validateField(input, system) {
  const key = input.name.replace('stats.', '')
  const field = system.characterSchema.fields.find(f => f.key === key)
  const errorEl = input.parentElement.querySelector(`[data-error="${key}"]`)
  if (!field) return

  const raw = input.value.trim()
  const value = Number(raw)
  let error = ''

  if (raw === '') {
    error = 'Requerido'
  } else if (Number.isNaN(value)) {
    error = 'Número'
  } else if (field.min != null && value < field.min) {
    error = `Mín ${field.min}`
  } else if (field.max != null && value > field.max) {
    error = `Máx ${field.max}`
  }

  input.classList.toggle('field__input--error', !!error)
  if (errorEl) errorEl.textContent = error
}

function showFormErrors(form, errors) {
  // Muestra errores en la parte superior; los individuales se marcan solos en blur
  let banner = form.querySelector('.form-banner')
  if (!banner) {
    banner = document.createElement('div')
    banner.className = 'form-banner'
    form.prepend(banner)
  }
  banner.innerHTML = `
    <strong>No se puede guardar:</strong>
    <ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
  `
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
