# RoadRol

PWA mobile-first para dirigir partidas de rol desde el móvil. Pensado para
viajes largos: el master lleva el teléfono, genera misiones y encuentros desde
packs, tira dados, edita stats en caliente y comparte la partida por enlace.

Sin cuentas, sin backend, sin API keys. Todo local en el dispositivo.

---

## Empezar

```bash
npm install
npm run dev        # http://localhost:5173
```

Para probar en el móvil (misma red):

```bash
npm run dev -- --host
# el server imprime la URL de red, ábrela en el teléfono
```

Build de producción:

```bash
npm run build      # → dist/
npm run preview
```

El service worker requiere **HTTPS o localhost**. Con la IP de red en el móvil
no habrá SW — solo funciona servido por HTTPS (Netlify, Vercel, Cloudflare
Pages) o en localhost.

---

## Primeros pasos

1. **Home → Packs de misiones → ✨ Importar 13 packs de ejemplo** — carga la
   biblioteca de 25 misiones y 145 encuentros.
2. **Nueva partida** — 4 pasos: sistema → ambientación → misión → personajes.
   El estado del wizard vive en `sessionStorage`, así que si creas un personaje
   a medio camino no pierdes las selecciones.
3. **Abre tu partida** y pulsa *Siguiente encuentro*. Cada encuentro trae
   imagen (de la librería, o generada bajo demanda), texto editable inline y
   bandeja de dados.

---

## Documentación

| Doc | Qué cubre |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Decisiones técnicas, capas, por qué PWA y no nativo |
| [docs/estructura.md](docs/estructura.md) | Mapa del repo, qué va en cada carpeta |
| [docs/contenido.md](docs/contenido.md) | Formato de packs, cómo escribir el tuyo |
| [docs/imagenes.md](docs/imagenes.md) | Sistema de imágenes, librería y matching |
| [docs/development.md](docs/development.md) | Scripts, checks, cómo añadir un sistema |
| [planning.md](planning.md) | Fases del proyecto y su estado |

---

## Estado

Fases 0–8 y 10 completas. Fase 9 (multijugador P2P con PeerJS) pendiente.

Funciona hoy: packs de misiones, wizard de 4 pasos, partida con encuentros
secuenciales, dados con animación, edición inline de stats y de encounters,
galería de personajes, import/export JSON, PWA instalable, 29 imágenes de
librería, y offline completo tras la primera carga.

---

## Stack

Vanilla JS + Vite. Sin framework. Una dependencia de runtime: `idb` (3 KB)
para IndexedDB.

- **Storage**: IndexedDB — stores `characters`, `games`, `packs`
- **Router**: hash router propio (~65 líneas)
- **PWA**: `vite-plugin-pwa` + workbox
- **Imágenes**: librería local precacheada + Pollinations bajo demanda

---

## Licencia

MIT. Ver [`LICENSE`](LICENSE).
