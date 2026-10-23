# Arquitectura

## Qué es

RoadRol es una PWA (Progressive Web App) single-page. El master dirige una
partida de rol desde el teléfono; los jugadores (opcionalmente, fase 9) se
conectan por enlace. Todo el estado vive en el dispositivo, en IndexedDB.

No hay backend. No hay cuentas. No hay API keys.

## Por qué PWA y no app nativa

Se evaluó Android nativo (Kotlin), React Native, Flutter y Capacitor. La
decisión fue PWA por estos motivos:

**El multijugador manda.** El requisito es que el master mande un enlace y cada
jugador entre por él. Solo una solution web cumple eso sin obligar a instalar
una app. Una app nativa obligaría a los jugadores a instalar (y en iOS, a
compilar dos veces).

**Cero mantenimiento de infraestructura.** `dist/` a Netlify/Vercel/Cloudflare
Pages y listo. Sin Play Console, sin revisión de apps, sin certificates.

**Iteración inmediata.** Cambias un prompt o un texto y redespliegas. El
siguiente load del master ya tiene la versión nueva. Una app en Play Store
tarda días en aprobarse.

**Cross-platform real.** El master usa lo que lleve en el viaje: iPhone,
Android, o un portátil.

Lo que se pierde: notificaciones push fiables en iOS, haptics avanzados,
acceso a cámara/GPS fino. Ninguno es crítico para dirigir una partida de rol
en un coche.

**Cuándo revisitarla:** si aparece una necesidad que solo nativo resuelve
(cámara con control fino, BLE, sync en background fiable), el camino es
**Capacitor** — envuelve esta misma web en una APK sin reescribir la lógica.

## Capas

```
main.js
  └─ ui/router.js          ← hash router, despacha a handlers
       └─ ui/screens/*     ← estado + eventos + orquestación
            └─ ui/components/*  ← renderers puros (HTML → string)
       └─ core/*            ← storage, dice, images, packs, pwa
            └─ modules/*    ← sistemas de juego y ambientaciones
```

### Regla de dependencia

Las flechas solo bajan. Nunca se sube.

- `core/` no importa de `ui/`
- `ui/components/` no importa de `ui/screens/`
- `ui/screens/` puede importar de `core/`, `modules/` y `components/`

Esto permite testear `core/` en Node sin DOM (ver [development.md](development.md)).

## Módulos: sistemas y ambientaciones

`src/modules/` contiene los sistemas de juego. Cada uno es un objeto con:

```js
{
  id, name,
  characterSchema: { fields: [...] },  // genera el formulario automáticamente
  defaultStats(),                      // stats de un personaje nuevo
  validateCharacter(json),             // → { ok, errors[] }
  systemPrompt,                        // rol del LLM (fase 9)
  encounterPrompts                     // por tipo de encuentro (fase 9)
}
```

Añadir un sistema nuevo es escribir **un archivo** y añadirlo al array de
`modules/index.js`. El formulario, la validación y el storage se adaptan solos.

Ambientaciones (`src/modules/settings/`) son más simples: `id`, `name`, `tone`,
`promptContext`. Se usan como contexto de flavor.

## Storage

IndexedDB vía `idb` (3 KB). Tres object stores:

| Store | Key | Contenido |
|---|---|---|
| `characters` | `id` | `{ name, system, setting, stats{}, notes }` |
| `games` | `id` | `{ name, mission, encounters[], characters[], ... }` |
| `packs` | `id` | `{ name, system, missions[] }` |

**Versionado**: la DB va en v2 (packs se añadió en v2). El `upgrade` callback
crea stores condicionalmente por `oldVersion`.

**Por qué IndexedDB y no localStorage**: localStorage es síncrono, limitado a
~5 MB y todo strings. Una partida con historial de tiradas no cabe cómodamente.

**localStorage se usa solo para** preferencias de UI (expresión de dados
recuerdada por partida) y el estado del wizard (`sessionStorage`).

## Imágenes

Tres capas con degradado, ver [imagenes.md](imagenes.md).

1. **Librería local** — 29 imágenes con tags semánticos, precacheadas por el SW
2. **Pollinations** — URL generada bajo demanda si no hay match en la librería
3. **Gradient CSS** — fallback determinista, nunca falla

## PWA

`vite-plugin-pwa` genera un service worker workbox en build.

- **Precache**: shell + assets + `public/**` (packs, imágenes, iconos)
- **globPatterns**: `js,css,html,json,jpg,svg` — los `json` son los packs de
  muestra, los `jpg/svg` la librería de imágenes
- **Estrategia**: `precacheAndRoute` + `NavigationRoute` (SPA fallback)
- **Updates**: `autoUpdate` — el nuevo SW se activa en el siguiente load, sin
  prompt al usuario. Un banner PWA notifica si hay una versión esperando.

## Deuda técnica conocida

Cosas que se saben que están mal o son frágiles, con su detonante:

| Deuda | Por qué | Cuándo arreglar |
|---|---|---|
| `confirm()`/`alert()` nativos | UX pobre en móvil, bloquea el hilo | Si se nota en uso real → modal custom |
| Gallery repinta en cada keystroke del search | Con >100 personajes se nota | Si la galería crece |
| Sin tests de UI | Solo hay checks de lógica pura | Si se toca mucho el render |
| Sin CSP | Cualquier XSS puede leer las prefs de localStorage | Antes de aceptar packs de terceros |
| Iconos SVG en manifest | iOS no soporta SVG → hace screenshot | Si se publica a App Store |
| `SYNONYMS` en `images.js` ajustados a mano a los packs actuales | Nuevos packs con otro vocabulario necesitan ampliarlo | Al importar packs nuevos |