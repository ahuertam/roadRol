# Estructura del repo

## Mapa

```
roadRol/
├── index.html              Entry point. Meta PWA + #pwa-banners
├── vite.config.js          Vite + vite-plugin-pwa (manifest, workbox, precache)
├── package.json
├── planning.md             Fases del proyecto
├── README.md
│
├── public/                 Se copia tal cual a dist/
│   ├── icons/icon.svg      Icono de la PWA
│   ├── images/library/     29 imágenes de fondo + manifest.json con tags
│   └── samples/            13 packs de misiones de ejemplo (.json)
│
├── scripts/                Herramientas de Node (no forman parte del bundle)
│   ├── generate-image-library.mjs   Descarga la librería de Pollinations
│   └── test-image-matching.mjs      Check del matching entity→imagen
│
└── src/
    ├── main.js             Bootstrap: seed + banners PWA + rutas
    │
    ├── core/               Sin DOM. Testeable en Node.
    │   ├── storage.js      IndexedDB (characters, games, packs)
    │   ├── dice.js         Parser NdM y animación de tirada
    │   ├── images.js       Matching entity→imagen, Pollinations, gradients
    │   ├── packs.js        Import/validación de packs
    │   ├── importExport.js Export/import JSON
    │   ├── pwa.js          Install prompt + SW update
    │   ├── seed.js         Personajes de ejemplo en primer arranque
    │   ├── models.js       Tipos JSDoc (sin runtime)
    │   ├── escape.js       escapeHtml — usar SIEMPRE al interpolar user data
    │   └── id.js           UUID (crypto.randomUUID)
    │
    ├── modules/            Sistemas de juego y ambientaciones
    │   ├── index.js        Registro: arrays + getSystem()/getSetting()
    │   ├── systems/        dnd5e.js, cthulhu.js
    │   └── settings/       fantasy.js, horror.js
    │
    ├── styles/
    │   ├── reset.css
    │   └── app.css         Tokens + todos los componentes (mobile-first)
    │
    └── ui/
        ├── router.js       Hash router: '#/game/:id', query params
        ├── pwaBanners.js   Banners de install/update
        ├── components/     Renderers puros (HTML → string)
        │   ├── characterCard.js
        │   ├── characterForm.js
        │   └── diceTray.js
        └── screens/        Estado + eventos (uno por pantalla)
            ├── home.js         Lista partidas, import universal
            ├── setup.js        Wizard 4 pasos
            ├── game/
            │   ├── index.js    Lógica de partida (estado, dados, acciones)
            │   └── views.js    Renderers puros de la partida
            ├── gallery.js      Galería de personajes
            ├── character.js    Crear/editar personaje
            └── packs.js        Gestionar packs
```

## Por qué `game/` es un directorio

`game/index.js` (407 líneas, lógica) + `game/views.js` (217, render). Nadie
más llega a 400 líneas. El módulo de directorio deja claro que la pantalla de
partida tiene dos mitades: estado y presentación. Si alguna vez crece más, ahí
dentro cabe el multijugador sin ensuciar `views.js`.

## Reglas de imports

```
main.js → ui/router.js → ui/screens/* → ui/components/*
                                  ↘ core/*
                                  ↘ modules/*
```

Nunca se sube. Consecuencia práctica: `core/` se puede testear en Node sin
DOM, y los `components/` se renderizan sin efectos secundarios.

## Dónde va cada cosa nueva

| Quiero… | Va en |
|---|---|
| Un sistema de juego nuevo | `modules/systems/<nombre>.js` + array en `modules/index.js` |
| Una ambientación nueva | `modules/settings/<nombre>.js` + array en `modules/index.js` |
| Un pack de misiones | Fichero `.json` en cualquier sitio, se importa desde la app |
| Una imagen de la librería | `public/images/library/` + entrada en `manifest.json` |
| Un estilo | `styles/app.css`, sección con comentario `/* ==== nombre ==== */` |
| Lógica pura de negocio | `core/`, con su función test en `scripts/` |
| Una pantalla nueva | `ui/screens/<nombre>.js`, ruta en `main.js` |