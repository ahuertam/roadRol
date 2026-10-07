// Bandeja de dados: input + presets + selector de personaje + botón tirar.
// ponytail: el submit lo gestiona la pantalla padre; aquí solo emitimos HTML.

import { escapeHtml } from '../../core/escape.js'

const PRESETS = ['1d20', '1d20+5', '2d6', '1d100', '3d6']

export function renderDiceTray({ characters, expression = '1d20', characterId = '', lastResult = null }) {
  const characterOptions = [
    `<option value="">(sin personaje / NPC)</option>`,
    ...characters.map(c => `
      <option value="${escapeHtml(c.id)}" ${characterId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>
    `)
  ].join('')

  const resultHtml = lastResult ? `
    <div class="dice-result">
      <div class="dice-result__rolls">${lastResult.rolls.map(r => `<span class="die">${r}</span>`).join('')}${lastResult.modifier !== 0 ? ` <span class="dice-result__mod">${lastResult.modifier > 0 ? '+' : ''}${lastResult.modifier}</span>` : ''}</div>
      <div class="dice-result__total">${lastResult.total}</div>
    </div>
  ` : ''

  return `
    <div class="dice-tray" data-dice-tray>
      <label class="field">
        <span class="field__label">Expresión</span>
        <input type="text" data-dice-expr class="field__input" value="${escapeHtml(expression)}" placeholder="2d6+3" autocomplete="off" />
      </label>

      <div class="dice-presets">
        ${PRESETS.map(p => `<button type="button" class="btn btn--sm btn--ghost" data-preset="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join('')}
      </div>

      <label class="field">
        <span class="field__label">Personaje</span>
        <select data-dice-character class="field__input">${characterOptions}</select>
      </label>

      ${resultHtml}

      <div class="dice-tray__actions">
        <button type="button" class="btn btn--ghost" data-dice-cancel>Cancelar</button>
        <button type="button" class="btn btn--primary" data-dice-roll>Tirar 🎲</button>
      </div>
    </div>
  `
}
