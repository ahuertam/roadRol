# Arquitectura — Juego de rol web (master en móvil)

## Resumen del producto

Aplicación PWA mobile-first para dirigir partidas de rol en viajes largos. El master maneja todo desde su teléfono: crea partida, propone misiones/encuentros (generados por IA, validados manualmente), tira dados, edita stats, narra resultados. Multijugador opcional vía enlace compartido: cada jugador ve su ficha y tira dados, el master recibe e interpreta.

---

## Stack técnico

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | HTML + CSS + JS vanilla con **Vite** | Cero framework, build/dev mínimo, PWA estándar |
| PWA | Service worker + manifest | Instalable en móvil, usable offline |
| Almacenamiento local | **IndexedDB** vía librería `idb` (~1KB) | Objetos grandes, transacciones, mejor que `localStorage` |
| IA generativa | **Claude API** (Anthropic) con streaming | Una sola fuente por ahora, abstracción para añadir otras después |
| Multijugador | **PeerJS** sobre WebRTC | P2P, sin servidor propio (usa signaling público o self-hosted) |
| Estilos | CSS nativo con variables y media queries | Mobile-first responsive sin librerías |

### Por qué no un framework
Ponytail: para una app de este tamaño (un master, unos pocos jugadores, 4-5 pantallas), React/Vue/Svelte suman complejidad sin pagar. Vanilla + Vite da HMR, build y tipos básicos. Si en algún momento la UI se vuelve inmanejable, se mete Svelte sin reescribir la lógica.

### Por qué IndexedDB y no localStorage
localStorage es síncrono, limitado a ~5MB, todo strings. IndexedDB permite objetos, índices, transacciones. Una partida con historial de tiradas y múltiples encuentros cabe perfectamente y se puede consultar.

---

## Estructura del proyecto

```
/
├── index.html
├── manifest.webmanifest
├── sw.js                          # service worker (PWA + offline shell)
├── package.json
├── vite.config.js
├── public/
│   └── icons/                     # iconos PWA
└── src/
    ├── main.js                    # bootstrap + router hash
    ├── styles/
    │   ├── reset.css
    │   └── app.css                # mobile-first, tokens, layout
    ├── core/
    │   ├── storage.js             # wrapper IndexedDB (characters, games)
    │   ├── importExport.js        # JSON in/out con validación
    │   ├── dice.js                # parser "2d6+3", animación, historial
    │   ├── ai.js                  # llamadas a Claude API, parseo JSON
    │   ├── multiplayer.js         # PeerJS host/client, protocolo mensajes
    │   ├── state.js               # estado en memoria + subscripciones
    │   └── id.js                  # uuid v4 (crypto.randomUUID)
    ├── modules/
    │   ├── systems/               # 1 archivo por sistema de juego
    │   │   ├── dnd5e.js           # schema personaje + prompts
    │   │   ├── cthulhu.js
    │   │   └── index.js           # registro y carga
    │   └── settings/              # 1 archivo por ambientación
    │       ├── fantasy.js         # lore base, tono, flora/fauna
    │       ├── sci-fi.js
    │       ├── horror.js
    │       └── index.js
    └── ui/
        ├── router.js              # hash router minimal
        ├── screens/               # una pantalla = un módulo
        │   ├── home.js            # nueva / continuar / galería
        │   ├── setup.js           # sistema → ambientación → personajes
        │   ├── character.js       # crear/editar personaje
        │   ├── game.js            # vista master de partida
        │   ├── player.js          # vista jugador (link multijugador)
        │   └── components/        # modales, botones, inputs reutilizables
        └── components/
            ├── encounterCard.js
            ├── diceTray.js
            ├── characterCard.js
            └── shareLink.js
```

---

## Modelo de datos (JSON)

### Personaje

```json
{
  "id": "uuid",
  "name": "Thorin Escudo de Roble",
  "system": "dnd5e",
  "setting": "fantasy",
  "stats": {
    "hp": 32,
    "maxHp": 32,
    "ac": 17,
    "str": 16,
    "dex": 11,
    "con": 15,
    "int": 9,
    "wis": 13,
    "cha": 12
  },
  "notes": "Hombre enano, busca vengar a su clan",
  "createdAt": "2026-09-21T10:00:00Z",
  "updatedAt": "2026-09-21T10:00:00Z"
}
```

### Partida

```json
{
  "id": "uuid",
  "name": "La Mina Perdida",
  "system": "dnd5e",
  "setting": "fantasy",
  "status": "setup|active|finished",
  "characters": ["char-uuid-1", "char-uuid-2"],
  "mission": {
    "title": "Investigar la mina abandonada",
    "brief": "El pueblo de Robledo pide ayuda...",
    "objectives": ["Encontrar al minero perdido", "Recuperar el artefacto"]
  },
  "encounters": [
    {
      "id": "uuid",
      "type": "combat|puzzle|trap|conversation",
      "title": "Emboscada en el puente",
      "description": "Tres goblins...",
      "outcome": "pending|resolved",
      "masterNotes": "",
      "rollHistory": [
        { "characterId": "char-uuid-1", "expression": "1d20+5", "result": 18, "ts": "..." }
      ],
      "resolvedAt": null
    }
  ],
  "currentEncounterId": "uuid|null",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Módulo de sistema (`modules/systems/dnd5e.js`)

```js
export default {
  id: 'dnd5e',
  name: 'D&D 5e',
  characterSchema: {
    fields: [
      { key: 'hp',        type: 'number', label: 'HP',  min: 0 },
      { key: 'maxHp',     type: 'number', label: 'HP Máx' },
      { key: 'ac',        type: 'number', label: 'CA' },
      { key: 'str',       type: 'number', label: 'FUE', min: 1, max: 20 },
      { key: 'dex',       type: 'number', label: 'DES', min: 1, max: 20 },
      { key: 'con',       type: 'number', label: 'CON', min: 1, max: 20 },
      { key: 'int',       type: 'number', label: 'INT', min: 1, max: 20 },
      { key: 'wis',       type: 'number', label: 'SAB', min: 1, max: 20 },
      { key: 'cha',       type: 'number', label: 'CAR', min: 1, max: 20 }
    ]
  },
  // prompts enviados a la IA para cada tipo de encuentro
  encounterPrompts: {
    combat:      (ctx) => `...genera un combate para ${ctx.setting}...`,
    puzzle:      (ctx) => `...`,
    trap:        (ctx) => `...`,
    conversation:(ctx) => `...`
  },
  validateCharacter(json) { /* ... */ return { ok, errors } }
}
```

### Módulo de ambientación (`modules/settings/fantasy.js`)

```js
export default {
  id: 'fantasy',
  name: 'Fantasía clásica',
  tone: 'Medieval, magia, dragones',
  promptContext: 'Mundo de fantasía medieval con magia arcana...'
}
```

---

## Flujo de pantallas

```
┌────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Inicio │ →  │  Setup  │ →  │  Lobby  │ →  │ Partida │ → (loop de encuentros)
└────────┘    └─────────┘    └─────────┘    └─────────┘
   │              │              │              │
   │ galería   sistema         iniciar        finalizar
   │ importar  ambientación                   └──→ guardar
   │ exportar  personajes                     └──→ exportar
```

**1. Inicio** — botones: Nueva partida · Continuar · Galería personajes · Importar

**2. Setup** — wizard 3 pasos:
1. Sistema (D&D 5e, Cthulhu, …)
2. Ambientación (Fantasía, Sci-fi, …)
3. Personajes (crear nuevo / importar / elegir de galería)

**3. Lobby** — lista de personajes, botón "Iniciar partida"

**4. Partida** (vista master):
- Misión actual (collapsible arriba)
- Encuentro actual (prominente, tipo con icono)
- Botones: 🎲 Tirar dados · ✏️ Editar stats · 🔄 Regenerar encuentro · ✅ Finalizar y siguiente · 💾 Guardar
- Sidebar: personajes, feed de tiradas, enlace multijugador, historial
- Modal de dados: input `2d6+3`, botones rápidos, resultado con animación

**5. Vista jugador** (link multijugador):
- Su ficha (read-only salvo tirar dados)
- Botón tirar dados (con selección de qué dado)
- Feed de tiradas propias

---

## Generación de contenido con IA

Una sola capa `core/ai.js`:

```js
generateEncounter({ system, setting, mission, previousEncounter, type }) {
  const sys = loadSystem(system)
  const set = loadSetting(setting)
  const prompt = sys.encounterPrompts[type]({
    setting: set,
    mission,
    previousEncounter,
    type
  })
  // llamada a Claude API con system prompt estricto + response_format JSON
  // valida esquema, devuelve encuentro o lanza error
}
```

- **Validación humana primero**: siempre se muestra al master antes de aceptar
- **Regeneración**: mismo prompt + "intenta otra cosa, evita X"
- **Coste controlado**: cada generación es 1 llamada. Caché de misiones generadas para evitar repetir.

---

## Multijugador (PeerJS)

```
[Master]                    [Jugador A]    [Jugador B]
   │                              │              │
   │  genera partida              │              │
   │  crea Peer ID                │              │
   │  comparte enlace ───────────►│              │
   │                              │  conecta     │
   │                              │◄─────────────┤
   │  broadcast estado partida    │              │
   │  ─────────────────────────► │              │
   │  ◄──── tirada (2d20+5) ──────┤              │
   │  broadcast resultado         │              │
   │  ─────────────────────────────────────────►│
```

**Protocolo de mensajes** (JSON mínimo):

```jsonc
// master → cliente
{ "type": "state",   "payload": <GameState completo> }
{ "type": "roll",    "payload": { "result": 18, "by": "char-uuid", "expression": "1d20+5" } }

// cliente → master
{ "type": "hello",   "payload": { "characterId": "..." } }
{ "type": "rollReq", "payload": { "characterId": "...", "expression": "1d20+5" } }
```

**Por qué PeerJS** (ponytail): cero infra, latencia baja, gratis, 2-6 jugadores (caso típico). Limitación: si el master pierde conexión, partida se rompe. Aceptable para el caso de uso (viaje en coche, master siempre ahí).

---

## Importar / Exportar

- **Exportar partida/personaje**: botón → genera JSON pretty → descarga `.json` con timestamp
- **Importar**: file input → lee → valida con `system.validateCharacter/Game` → confirma → guarda
- **Validación tipada**: cada sistema declara su validador. Si falla, mensaje claro al usuario.

---

## Decisiones pendientes (para validar contigo)

1. **API de IA** — Claude API de Anthropic (mi recomendación) o prefieres otra (OpenAI, local)?
2. **Hosting / API key** — ¿la API key vive en el cliente (simple pero expuesta) o backend proxy mínimo (más seguro)?
3. **Sistemas iniciales** — ¿D&D 5e + Cthulhu como ejemplos + genérico? ¿O solo genérico y metemos uno a uno?
4. **Alcance MVP** — ¿multijugador desde v1 o se añade tras validar single-player?
5. **Edición de stats en partida** — ¿libre (master cambia lo que quiera) o con "modo edición" explícito para no tocar por accidente?
