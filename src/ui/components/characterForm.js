// Renderer del formulario de personaje, generado dinámicamente desde el schema del sistema.
// ponytail: el handler de submit se conecta desde la pantalla; aquí solo emitimos HTML.

import { settings } from '../../modules/index.js'

function fieldHtml(field, value) {
  const v = value ?? field.default ?? ''
  const minAttr = field.min != null ? `min="${field.min}"` : ''
  const maxAttr = field.max != null ? `max="${field.max}"` : ''
  return `
    <label class="field field--stat" data-field="${field.key}">
      <span class="field__label">${escapeHtml(field.label)}</span>
      <input
        type="number"
        inputmode="numeric"
        name="stats.${field.key}"
        value="${v}"
        ${minAttr}
        ${maxAttr}
        class="field__input"
      />
      <span class="field__error" data-error="${field.key}"></span>
    </label>
  `
}

function groupHtml(group, label, fields, draft) {
  return `
    <fieldset class="form-group">
      <legend>${escapeHtml(label)}</legend>
      <div class="form-grid">
        ${fields.map(f => fieldHtml(f, draft.stats[f.key])).join('')}
      </div>
    </fieldset>
  `
}

export function renderCharacterForm({ draft, system, isEdit }) {
  const vitalFields = system.characterSchema.fields.filter(f => f.group === 'vital')
  const abilityFields = system.characterSchema.fields.filter(f => f.group === 'ability')

  const settingOptions = [
    `<option value="">(sin ambientación)</option>`,
    ...settings.map(s => `
      <option value="${escapeHtml(s.id)}" ${draft.setting === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
    `)
  ].join('')

  return `
    <form class="character-form" data-form autocomplete="off">
      <label class="field">
        <span class="field__label">Nombre</span>
        <input type="text" name="name" value="${escapeHtml(draft.name)}" required class="field__input" placeholder="Nombre del personaje" />
      </label>

      <label class="field">
        <span class="field__label">Ambientación</span>
        <select name="setting" class="field__input">
          ${settingOptions}
        </select>
      </label>

      ${groupHtml('vital', 'Vital', vitalFields, draft)}
      ${abilityFields.length ? groupHtml('ability', 'Habilidades', abilityFields, draft) : ''}

      <label class="field">
        <span class="field__label">Notas</span>
        <textarea name="notes" rows="4" class="field__input" placeholder="Trasfondo, objetivos, secretos...">${escapeHtml(draft.notes || '')}</textarea>
      </label>

      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-nav="/gallery">Cancelar</button>
        <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar cambios' : 'Crear personaje'}</button>
      </div>
    </form>
  `
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}
