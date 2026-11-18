# Planning — RoadRol

Estado real del proyecto. Lo que está hecho, lo que se descartó y por qué, y lo
que queda.

- ✅ hecho
- ❌ descartado (con el motivo)
- ⬜ pendiente

---

## Fases

| Fase | Qué era | Estado |
|---|---|---|
| 0 | Esqueleto: Vite, PWA, hash router, Home | ✅ |
| 1 | Storage: IndexedDB (`idb`), modelos, import/export JSON, seed | ✅ |
| 2 | Sistemas (D&D 5e, CoC 7e) y ambientaciones (fantasía, horror) | ✅ |
| 3 | Wizard de personaje + galería con búsqueda y stats editables | ✅ |
| 4 | Setup de partida (4 pasos: sistema → ambientación → misión → personajes) | ✅ |
| 5 | Pantalla de partida: encuentros, dados, edición inline, finalizar | ✅ |
| 6 | Generación de encuentros con IA | ❌ → packs de misiones |
| 7 | Generación de misión con IA | ❌ → packs de misiones |
| 8 | Persistencia, home con "continuar partida", export/import | ✅ |
| 9 | Multijugador P2P | ⬜ pendiente |
| 10 | PWA instalable, offline, banners de install/update | ✅ |
| 11 | Pulido móvil (gestos, haptics, modo oscuro) | ⬜ parcial |

---

## Fases 6 y 7 · por qué se descartaron

El plan original generaba encuentros y misiones con la API de Claude: el master
elegía el tipo de encuentro, la IA lo escribía y el master lo validaba a mano
antes de aceptarlo.

Se sustituyó por **packs de misiones en JSON**: 13 packs de ejemplo (25
misiones, 125 encuentros) que el master importa y usa tal cual. Encaja mejor
con el producto actual — PWA offline, sin backend, sin cuentas, sin API keys —
que es lo que vende la app.

Lo que se perdió: la capacidad de improvisar un encuentro que ningún pack
cubre. Es justo la primera decisión abierta de abajo.

El código de prompts (`systemPrompt`, `encounterPrompts`, `buildPrompt`) que
quedó de aquella fase se borró en la limpieza: no lo leía nadie y era ruido. Si
la IA vuelve, se reescribe desde cero junto con el cliente API — no se
recupera del git, porque el prompt necesitará otra forma (contexto de partida,
caché, validación modal).

---

## Fase 9 · multijugador (pendiente)

El README promete "comparte la partida por enlace" y hoy no existe: la ruta
`#/player` es un placeholder.

Dos caminos, que no son la misma cosa:

- **PeerJS** — peer-to-peer real. Necesita servidor de señalización (STUN/TURN
  público), lo que mete una dependencia de red y superficie de bugs
  (reconexión, estado, permisos).
- **Enlace con código** — el master genera un código corto, el jugador lo
  introduce o escanea un QR. Más barato de prometer y de mantener.

Pendiente de decidir: cuál se implementa primero, si es que se implementa.

La fase 9 va, en cualquier caso, contra la promesa de "todo local, sin
backend" — es un cambio de producto, no una tarea técnica.

---

## Fase 11 · pulido móvil (parcial)

Hecho: `inputmode="numeric"` en los campos de stats, botones grandes, layout
mobile-first, viewport con `viewport-fit=cover`.

Pendiente: swipe para finalizar encuentro, long-press en el dado para el
historial, vibración háptica en nat 20 / nat 1, modo claro/oscuro según
sistema.

---

## Decisiones abiertas

1. **¿La IA vuelve?** Si sí, hay que decidir el cliente (API con clave del
   user, u Ollama/local) y rehacer los prompts por sistema.
2. **¿Multijugador?** PeerJS o enlace con código. Y si entra, rompe la promesa
   "sin backend".
3. **Iconos PNG** — el manifest solo declara SVG. iOS Safari no acepta SVG en
   `apple-touch-icon`: al instalar en iPhone sale el screenshot de la página.
   Es la plataforma principal de "mobile-first".

---

## Fuera de MVP

- [ ] Autenticación / cuentas (ahora todo local)
- [ ] Más sistemas (Pathfinder, Cyberpunk, etc.)
- [ ] Editor visual de stats dentro de partida (ahora solo números)
- [ ] Compartir partida multijugador persistente (master puede ausentarse)
- [ ] Importar tokens / mapas
- [ ] Notas de sesión con markdown
- [ ] Modo "narrador IA" (que la IA narre también, ahora solo master)

---

## Reglas que se mantienen

- **Sin framework de tests.** Cada check es un script de Node con
  `process.exit(1)` si falla. `npm test` los encadena. E2E aparte
  (`npm run e2e`, Chrome headless por CDP).
- **El CI corre lint → test → build → e2e** en cada push a `main` y cada PR.
- **Cada fase termina con un *check***: se prueba en navegador y se confirma
  que funciona antes de pasar a la siguiente.
- **Sin dependencias nuevas** sin justificar en `docs/development.md`.
