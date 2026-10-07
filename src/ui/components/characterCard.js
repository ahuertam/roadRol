// Card de personaje para la galería. Stats vitales inline-editables.

import { getSystem } from '../../modules/index.js'
import { escapeHtml } from '../../core/escape.js'

// Devuelve el "stat vital secundario" según el sistema (AC para D&D, SAN para CoC).
function secondaryVital(systemId) {
  if (systemId === 'dnd5e') return { key: 'ac', label: 'CA' }
  if (systemId === 'cthulhu') return { key: 'san', label: 'SAN' }
  return null
}

export function renderCharacterCard(character) {
  const system = getSystem(character.system)
  const systemName = system ? system.name : character.system
  const vital = secondaryVital(character.system)
  const vitalValue = vital ? character.stats[vital.key] ?? '-' : null

  return `
    <article class="character-card" data-character-id="${escapeHtml(character.id)}">
      <header class="character-card__header">
        <div>
          <h3 class="character-card__name">${escapeHtml(character.name)}</h3>
          <span class="character-card__meta">${escapeHtml(systemName)}${character.setting ? ' · ' + escapeHtml(character.setting) : ''}</span>
        </div>
      </header>

      <dl class="character-card__stats">
        <div class="character-card__stat">
          <dt>HP</dt>
          <dd>
            <span class="stat-edit" data-edit-stat="hp" data-id="${escapeHtml(character.id)}" tabindex="0" title="Click para editar" role="button">${escapeHtml(character.stats.hp ?? '-')}</span>
            /
            <span class="stat-edit" data-edit-stat="maxHp" data-id="${escapeHtml(character.id)}" tabindex="0" title="Click para editar" role="button">${escapeHtml(character.stats.maxHp ?? '-')}</span>
          </dd>
        </div>
        ${vital ? `
        <div class="character-card__stat">
          <dt>${escapeHtml(vital.label)}</dt>
          <dd>
            <span class="stat-edit" data-edit-stat="${vital.key}" data-id="${escapeHtml(character.id)}" tabindex="0" title="Click para editar" role="button">${escapeHtml(vitalValue)}</span>
          </dd>
        </div>
        ` : ''}
      </dl>

      ${character.notes ? `<p class="character-card__notes">${escapeHtml(character.notes)}</p>` : ''}

      <div class="character-card__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-action="edit" data-id="${escapeHtml(character.id)}">Editar</button>
        <button type="button" class="btn btn--ghost btn--sm" data-action="duplicate" data-id="${escapeHtml(character.id)}">Duplicar</button>
        <button type="button" class="btn btn--ghost btn--sm" data-action="export" data-id="${escapeHtml(character.id)}">Exportar</button>
        <button type="button" class="btn btn--ghost btn--sm btn--danger" data-action="delete" data-id="${escapeHtml(character.id)}">Eliminar</button>
      </div>
    </article>
  `
}
