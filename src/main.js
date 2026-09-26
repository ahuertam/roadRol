import './styles/reset.css'
import './styles/app.css'
import { mount } from './ui/router.js'
import { renderHome } from './ui/screens/home.js'
import { renderPlaceholder } from './ui/screens/placeholder.js'
import { seedIfEmpty } from './core/seed.js'
import {
  listCharacters, getCharacter, saveCharacter, deleteCharacter,
  listGames, getGame, saveGame, deleteGame
} from './core/storage.js'
import { downloadJSON, readJSONFile, validateShape, defaultFilename } from './core/importExport.js'
import { newId } from './core/id.js'

// Seed inicial idempotente (corre antes del primer render)
seedIfEmpty().catch((err) => console.error('Seed falló:', err))

mount({
  '/':        renderHome,
  '/setup':   (p) => renderPlaceholder('Setup de partida', '/'),
  '/game':    (p) => renderPlaceholder('Partida en curso', '/'),
  '/game/:id':(p) => renderPlaceholder(`Partida ${p.id}`, '/'),
  '/player':  (p) => renderPlaceholder('Vista de jugador', '/')
})

// ponytail: expone la API en window solo en dev para probar desde la consola.
// En producción desaparece (tree-shaking lo quita).
if (import.meta.env.DEV) {
  window.roadrol = {
    // storage
    listCharacters, getCharacter, saveCharacter, deleteCharacter,
    listGames, getGame, saveGame, deleteGame,
    // import/export
    downloadJSON, readJSONFile, validateShape, defaultFilename,
    // utils
    newId, seedIfEmpty
  }
  console.info('🛠️ roadrol API expuesta en window.roadrol (solo dev)')
}
