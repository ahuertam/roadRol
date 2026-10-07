import './styles/reset.css'
import './styles/app.css'
import { mount } from './ui/router.js'
import { renderHome } from './ui/screens/home.js'
import { renderPlaceholder } from './ui/screens/placeholder.js'
import { renderCharacterNew, renderCharacterEdit } from './ui/screens/character.js'
import { renderGallery } from './ui/screens/gallery.js'
import { renderSetup } from './ui/screens/setup.js'
import { seedIfEmpty } from './core/seed.js'
import {
  listCharacters, getCharacter, saveCharacter, deleteCharacter,
  listGames, getGame, saveGame, deleteGame
} from './core/storage.js'
import { downloadJSON, readJSONFile, validateShape, defaultFilename } from './core/importExport.js'
import { newId } from './core/id.js'
import { systems, settings, getSystem, getSetting } from './modules/index.js'

// Seed inicial idempotente. Se hace antes de montar rutas para evitar que la
// primera navegación a galería vea un array vacío durante el primer arranque.
// ponytail: await top-level no soportado por el target; usamos un async IIFE.
;(async () => {
  try {
    await seedIfEmpty()
  } catch (err) {
    console.error('Seed falló:', err)
  }
  mountApp()
})()

function mountApp() {
  mount({
    '/':                          renderHome,
    '/setup':                     renderSetup,
    '/game':                      (p, c) => { c.innerHTML = renderPlaceholder('Partida en curso', '/') },
    '/game/:id':                  (p, c) => { c.innerHTML = renderPlaceholder(`Partida ${p.id}`, '/') },
    '/player':                    (p, c) => { c.innerHTML = renderPlaceholder('Vista de jugador', '/') },
    '/gallery':                   renderGallery,
    '/character/new/:system':     renderCharacterNew,
    '/character/:id':             renderCharacterEdit
  })
}

// ponytail: expone la API en window solo en dev para probar desde la consola.
// En producción desaparece (tree-shaking lo quita).
if (import.meta.env.DEV) {
  window.roadrol = {
    // storage
    listCharacters, getCharacter, saveCharacter, deleteCharacter,
    listGames, getGame, saveGame, deleteGame,
    // import/export
    downloadJSON, readJSONFile, validateShape, defaultFilename,
    // módulos
    systems, settings, getSystem, getSetting,
    // utils
    newId, seedIfEmpty
  }
  console.info('🛠️ roadrol API expuesta en window.roadrol (solo dev)')
}
