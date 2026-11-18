# Development

## Scripts

```bash
npm run dev              # dev server en :5173
npm run dev -- --host    # dev server accesible desde el móvil en la red local
npm run build            # → dist/ con service worker
npm run preview          # sirve dist/ para probar el build
npm run lint             # parseo de todos los JS (sin dependencias)
npm test                 # todos los checks de Node
npm run e2e              # E2E en Chrome headless (necesita el build servido)
```

Checks sueltos (no hay framework de test):

```bash
node scripts/test-id.mjs             # UUID en contexto inseguro
node scripts/test-dice.mjs           # parser y tirada de dados
node scripts/test-regressions.mjs    # bugs de P0 (ver abajo)
node scripts/test-image-matching.mjs # matching entity→imagen, 10 casos
node scripts/test-game-views.mjs     # render de la pantalla de partida
node scripts/generate-image-library.mjs  # descarga la librería de imágenes
```

## Checks que existen

Sin framework: cada check es un script de Node con `process.exit(1)` si falla.
`npm test` los encadena.

**`scripts/test-id.mjs`** — `crypto.randomUUID()` solo existe en contexto
seguro. Simula un contexto inseguro y comprueba que el fallback devuelve un
UUID v4 válido.

**`scripts/test-dice.mjs`** — el parser `NdM(+|-)X`, sus límites (máx. 100
dados, 1.000 caras) y que el total sea la suma de los dados más el modificador.
Incluye 200 tiradas para cazar errores de rango. Es la lógica que no se ve al
usar la app: un total mal calculado no crashea, que da un número equivocado.

**`scripts/test-regressions.mjs`** — los bugs que no crasheaban pero se
comportaban mal:

- Un `Game` incompleto (importado a mano, de una versión vieja) no puede
  reventar el render de la pantalla de partida. Cubre `normalizeGame()` de
  `core/models.js`.
- Los atributos de edición inline de la tarjeta de personaje tienen que
  coincidir con los que conecta `gallery.js`. Un desajuste ahí hacía que el
  SAN/CA fuese de adorno: el elemento no tenía listener.
- Si una partida referencia personajes que no están en el dispositivo, se avisa.

**`scripts/test-image-matching.mjs`** — replica el scoring de `core/images.js` y
lo corre contra 10 entidades reales de los packs, verificando que eligen la
imagen semánticamente correcta. Es el único sitio donde el scoring está
escrito dos veces; si cambias uno, corre el otro.

**`scripts/test-game-views.mjs`** — renderiza la pantalla de partida con 4
casos y comprueba el HTML que sale.

**`scripts/generate-image-library.mjs`** — tiene `--dry` para listar sin
descargar, y `--only=SLUG` para reintentar uno fallido. Falla con exit code 1
si algún download falla, para poder encadenarlo en CI.

## Lint

`npm run lint` corre `eslint .` con el flat config de `eslint.config.js`
(`js.configs.recommended` + los globals de browser/node de cada carpeta).

ponytail: si eslint no está instalado, `scripts/lint.mjs` cae a `node --check`
sobre cada JS, para que el comando y el CI no dependan de una devDependency
concreta. Con eslint: `no-unused-vars` y `no-undef` además de la sintaxis.

## E2E

`npm run e2e` arranca un Chrome headless, lo conecta por CDP y comprueba los
flujos que los checks de Node no ven: la app monta, una partida importada a
mano se abre sin reventar, el SAN se edita en línea en la galería y se guarda,
y no hay errores JS en consola.

Necesita el build servido en otra terminal:

```bash
npm run build
npm run preview -- --port 4173 &
npm run e2e
```

Chrome se busca en las rutas habituales; si está en otro sitio, define
`CHROME_PATH`.

## CI

`.github/workflows/ci.yml` corre `npm ci` → `npm run lint` → `npm test` →
`npm run build` → E2E en Chrome headless. En cada push a `main` y en cada PR.

## Añadir un sistema de juego

1. Crear `src/modules/systems/<nombre>.js`:

```js
export default {
  id: 'mi-sistema',
  name: 'Mi Sistema',
  characterSchema: {
    fields: [
      { key: 'hp',  type: 'number', label: 'HP',  min: 0, group: 'vital' },
      { key: 'str', type: 'number', label: 'STR', min: 1, max: 20, default: 10, group: 'ability' }
    ]
  },
  defaultStats: () => ({ hp: 10, str: 10 }),
  validateCharacter(json) { /* → { ok: true } | { ok: false, errors: [...] } */ }
}
```

2. Añadirlo al array en `src/modules/index.js`.

El formulario del personaje, la validación y el guardado se adaptan solos. El
`group: 'vital'` sale en un fieldset, `group: 'ability'` en otro.

El `defaultStats()` debe devolver exactamente las keys que declara
`characterSchema.fields` — `validateCharacter` da error si falta alguna.

## Añadir una ambientación

`src/modules/settings/<nombre>.js`, con `id`, `name` y `tone`. Añadir al array
en `modules/index.js`.

## Añadir un pack de misiones

Ver [contenido.md](contenido.md). Se importa desde la app (Home → Packs →
Importar), no hace falta tocar código.

## Convenciones

**`ponytail:` en el código.** Cuando un atajo o simplificación tiene un techo
conocido, se comenta con el techo y el camino de upgrade:

```js
// ponytail: el threshold es 6 porque con <6 preferimos gradient a una imagen
// genérica. Subir si la librería crece.
```

**Escapar siempre.** Cualquier dato de usuario interpolado en HTML pasa por
`escapeHtml` de `core/escape.js`. Sin excepción — hay casos donde se pasaron
stats sin escapar (XSS) y se corrigieron.

**Sin dependencias nuevas.** `idb` es la única runtime. Antes de añadir un
paquete, comprobar si el stdlib o algo ya instalado lo cubre. Si se añade de
verdad, documentar aquí por qué.

**Comentarios en español, código en inglés.** Los identificadores van en
inglés (`renderEncounter`, `listCharacters`); la prosa, en español.

## PWA en local

El service worker necesita HTTPS o localhost. En la IP de red del móvil no hay
SW — se ve la app, pero sin offline. Para probar offline de verdad:

```bash
npm run build
npx serve dist        # o cualquier servidor con HTTPS
```

Y en DevTools → Application → Service Workers → *Offline* para verificar.

## Añadir imágenes a la librería

Ver [imagenes.md](imagenes.md). En resumen: añade la entrada al
`manifest.json` de `public/images/library/` y corre el script.

## Estado del proyecto

Ver `planning.md` para el estado real de las fases y las decisiones abiertas.

Lo grande que queda: la fase 9 (multijugador). Cuando se implemente, afecta a
`game/index.js` (sincronizar estado) y crea `core/multiplayer.js`. La
estructura de `game/` ya está preparada: la lógica está en `index.js`, el
render en `views.js`, así que meter la sincronización no toca la presentación.