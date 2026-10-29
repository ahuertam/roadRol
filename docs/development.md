# Development

## Scripts

```bash
npm run dev              # dev server en :5173
npm run dev -- --host    # dev server accesible desde el móvil en la red local
npm run build            # → dist/ con service worker
npm run preview          # sirve dist/ para probar el build
```

Checks sueltos (no hay framework de test):

```bash
node scripts/test-image-matching.mjs      # matching entity→imagen, 10 casos
node scripts/generate-image-library.mjs  # descarga la librería de imágenes
```

## Checks que existen

Solo hay dos, y cubren lo único que es lógica notrivial:

**`scripts/test-image-matching.mjs`** — replica el scoring de `core/images.js` y
lo corre contra 10 entidades reales de los packs, verificando que eligen la
imagen semánticamente correcta. Es el único sitio donde el scoring está
escrito dos veces; si cambias uno, corre el otro.

**`scripts/generate-image-library.mjs`** — tiene `--dry` para listar sin
descargar, y `--only=SLUG` para reintentar uno fallido. Falla con exit code 1
si algún download falla, para poder encadenarlo en CI.

Lo demás es render o CRUD sobre IndexedDB: si se rompe, se ve al usar la app.
Ponerle un framework de tests a eso es sobreingeniería.

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
  validateCharacter(json) { /* → { ok: true } | { ok: false, errors: [...] } */ },
  systemPrompt: 'Eres un director de juego experto…',  // opcional, fase 9
  encounterPrompts: { /* opcional, fase 9 */ }
}
```

2. Añadirlo al array en `src/modules/index.js`.

El formulario del personaje, la validación y el guardado se adaptan solos. El
`group: 'vital'` sale en un fieldset, `group: 'ability'` en otro.

El `defaultStats()` debe devolver exactamente las keys que declara
`characterSchema.fields` — `validateCharacter` da error si falta alguna.

## Añadir una ambientación

`src/modules/settings/<nombre>.js`, con `id`, `name`, `tone` y
`promptContext`. Añadir al array en `modules/index.js`.

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

Ver `planning.md` para las fases. Fase 9 (multijugador P2P) pendiente — cuando
se implemente, afecta a `game/index.js` (sincronizar estado) y crea
`core/multiplayer.js`. La estructura de `game/` ya está preparada: la lógica
está en `index.js`, el render en `views.js`, así que meter la sincronización
no toca la presentación.