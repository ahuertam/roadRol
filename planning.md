# Planning — Juego de rol web

## Convenciones

- **MVP** = partidas single-device completas (master hace todo, guardado local, IA genera contenido)
- **v1** = MVP + multijugador
- Cada fase termina con un *check*: se prueba en navegador y se confirma que funciona antes de pasar a la siguiente
- Sin frameworks (vanilla + Vite). Si una pantalla se vuelve inmanejable, se mete Svelte solo para esa pantalla

---

## Fase 0 · Esqueleto

**Qué se hace:**
- `npm init` + Vite + plugin PWA (`vite-plugin-pwa`)
- `index.html` con viewport mobile-first
- `manifest.webmanifest` (nombre, iconos placeholder, theme color)
- Router hash mínimo (`#/`, `#/setup`, `#/game/:id`, `#/player/:gameId/:charId`)
- CSS reset + tokens (colores, spacing, tipografía)
- Pantalla Home con 4 botones stub (sin lógica)

**Check:** abrir en móvil, instalar como PWA, navegar entre hashes, UI responsive.

---

## Fase 1 · Storage + modelos

**Qué se hace:**
- `core/storage.js`: wrapper IndexedDB (vía `idb`)
  - `listCharacters()`, `getCharacter(id)`, `saveCharacter(c)`, `deleteCharacter(id)`
  - `listGames()`, `getGame(id)`, `saveGame(g)`, `deleteGame(id)`
- `core/id.js`: `crypto.randomUUID()`
- `core/importExport.js`: `exportJSON(entity)`, `importJSON(file)` → valida y guarda
- Modelos JSDoc en `core/models.js` (Character, Game, Encounter, Roll)
- Seed: 2 personajes de ejemplo en D&D 5e al primer arranque

**Check:** crear personaje por consola del navegador, recargar, sigue ahí. Exportar JSON, importar en otra pestaña.

---

## Fase 2 · Sistemas y ambientaciones

**Qué se hace:**
- `modules/systems/dnd5e.js`: schema personaje, validador, prompts por tipo de encuentro
- `modules/systems/cthulhu.js`: schema (SAN, HP, skills, era 1920s), validador, prompts
- `modules/settings/fantasy.js`, `horror.js` (fantasía para D&D, horror para Cthulhu)
- `modules/index.js`: registro y carga por id
- `core/loader.js`: `loadSystem(id)`, `loadSetting(id)` con caché

**Check:** cargar sistema por id desde consola, validar personaje de prueba, ver prompts generados.

---

## Fase 3 · Wizard de creación de personaje

**Qué se hace:**
- Pantalla `#/character/new?system=dnd5e`: formulario dinámico según `system.characterSchema`
- Edición libre: cualquier campo se modifica en cualquier momento (sin modo edición, como papel)
- Validación inline (rojo si `min/max` falla)
- Guardar → vuelve a setup o a galería
- Galería de personajes con búsqueda por nombre/sistema y botón editar/eliminar/duplicar

**Check:** crear personaje D&D, crear personaje Cthulhu, editar HP en la galería, recargar y persiste.

---

## Fase 4 · Setup de partida

**Qué se hace:**
- Pantalla `#/setup` con 3 pasos:
  1. Elegir sistema (lista de los registrados)
  2. Elegir ambientación (filtrada o sugerida por sistema, pero libre)
  3. Elegir personajes (multi-select de galería + "crear nuevo" inline)
- Botón "Iniciar partida" → crea Game, redirige a `#/game/:id`
- Estado inicial de Game: status `active`, mission `null`, encounters `[]`

**Check:** flujo completo de setup → entra a pantalla de partida vacía con personajes en sidebar.

---

## Fase 5 · Pantalla de partida (master, single-device)

**Qué se hace:**
- Layout: header (misión colapsable) + encuentro actual grande + sidebar (personajes, feed tiradas)
- Botones principales: 🎲 Dados · 🔄 Regenerar · ✅ Finalizar
- `core/dice.js`: parser `NdM(+|-)X`, animación, feed
- Edición de stats inline en cada personaje del sidebar (input directo, blur guarda)
- "Finalizar encuentro" → marca `outcome=resolved`, pasa al siguiente
- Cuando no hay siguiente → generar nuevo encuentro (botón explícito)

**Check:** tirar dados, modificar HP de un PJ en mitad de "combate", finalizar encuentro, generar el siguiente manualmente.

---

## Fase 6 · Generación con IA

**Qué se hace:**
- `core/ai.js`: cliente Claude API con `response_format: json_object`, system prompt estricto
- Configuración: API key guardada en `localStorage` (configurada en Home/settings)
- Flujo: master elige tipo de encuentro → llamada IA → resultado parseado y validado → **modal de validación** donde el master ve título/desc y acepta/regenera/edita texto libre
- Cada sistema declara sus prompts con contexto (setting, mission, último encuentro)
- Caché: misma (tipo + misión) → devuelve cacheado; botón "forzar nuevo" la salta

**Check:** configurar API key, generar encuentro de combate en D&D, regenerar 3 veces, validar uno, ver que aparece en pantalla.

---

## Fase 7 · Generación de misión

**Qué se hace:**
- Pantalla inicial de partida vacía: botón "Generar misión"
- Mismo flujo que encuentro (IA → validación → aceptar)
- Una vez aceptada, se muestra arriba colapsable; botones rápidos para regenerar objetivo concreto
- El "tipo de encuentro" se decide por el master al pedirlo (IA no decide por él, mantiene control)

**Check:** generar misión, leerla, generar primer encuentro ligado a ella.

---

## Fase 8 · Persistencia y galerías

**Qué se hace:**
- Auto-guardado de Game en cada cambio (debounced 500ms)
- En Home: lista "Continuar partida" (último updated), "Partidas finalizadas"
- Botones por partida: continuar, exportar JSON, eliminar
- Botones por personaje: exportar JSON, importar JSON

**Check:** jugar 10 min, cerrar pestaña, volver a abrir, partida sigue exactamente donde estaba.

---

## Fase 9 · Multijugador (PeerJS)

**Qué se hace:**
- `core/multiplayer.js`: abstracción host/client con PeerJS
- Botón "Hospedar partida" en partida → genera peer id → muestra enlace `?join=<id>`
- Vista `#/player/:id`: cliente conecta, recibe estado, identifica su personaje, ve ficha
- Protocolo: `state`, `rollReq` (cliente→master), `roll` (master→todos)
- Botón "Tirar dados" en vista jugador → envía petición, master resuelve y broadcast
- Master ve feed de tiradas entrantes con personaje origen

**Check:** dos pestañas abiertas (master + jugador simulado), tirar dado como jugador, master ve resultado y lo broadcasta.

---

## Fase 10 · PWA + offline

**Qué se hace:**
- Service worker con vite-plugin-pwa: cachea shell + assets
- IndexedDB funciona offline, IA no (mostrar mensaje claro si no hay red al generar)
- Pantalla de configuración de API key con validación
- Iconos PWA definitivos

**Check:** instalar PWA, activar modo avión, abrir partida guardada, todo carga menos generación IA.

---

## Fase 11 · Pulido móvil

**Qué se hace:**
- Gestos: swipe para finalizar encuentro, long-press en dado para ver historial completo
- Teclado numérico en inputs de stats
- Vibración háptica al tirar dado crítico (nat 20 / nat 1)
- Modo oscuro/claro según sistema
- Atajos: botones grandes en master view, dedos gordos

**Check:** uso en móvil real durante 30 min sin frustraciones.

---

## Fuera de MVP (después)

- [ ] Autenticación / cuentas (ahora todo local)
- [ ] Más sistemas (Pathfinder, Cyberpunk, etc.)
- [ ] Editor visual de stats dentro de partida (ahora solo números)
- [ ] Compartir partida multijugador persistente (master puede ausentarse)
- [ ] Importar tokens / mapas
- [ ] Notas de sesión con markdown
- [ ] Modo "narrador IA" (que la IA narre también, ahora solo master)

---

## Orden de ejecución

```
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11
        │           │       │       │       │
        └── MVP funcional ──┘       │       │
                                    └── v1 ──┘
                                            └── pulido
```

Estimación rough: cada fase = 1-3 sesiones cortas. MVP (fase 8) = fin de semana dedicado con cabeza. v1 completa (fase 10) = +1-2 fines de semana. Pulido (fase 11) = iterativo.
