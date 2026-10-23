# Sistema de imágenes

Cada partida, misión, encuentro y personaje tiene una imagen. Hay tres capas,
de mejor a peor. Nunca se ve roto.

```
1. Librería local     29 imágenes precacheadas por el SW → 0 ms, offline
2. Pollinations       URL generada bajo demanda → ~5-15 s la primera vez
3. Gradient CSS       color determinista del nombre → instantáneo, siempre
```

## 1. Librería local

`public/images/library/manifest.json` mapea cada imagen a sus tags semánticos.

```json
{
  "slug": "coc-mansion-exterior",
  "tags": ["cthulhu", "horror", "mansion", "gothic", "outdoor", "night",
           "investigation", "mystery"],
  "prompt": "gothic haunted mansion exterior at night with full moon, dead trees…"
}
```

15 imágenes de fantasía (`dnd-*`) y 14 de horror (`coc-*`).

Regenerar o añadir imágenes:

```bash
# Ver qué falta
node scripts/generate-image-library.mjs --dry

# Descargar las que falten (con backoff; Pollinations limita por IP)
node scripts/generate-image-library.mjs

# Reintentar una concreta
node scripts/generate-image-library.mjs --only=coc-arkham-street
```

Pollinations devuelve 402 con facilidad si pides muchas seguidas. El script
hace cooldown de 30 s y reintenta 6 veces; si se interrumpe, no pierde lo ya
descargado.

## 2. Matching: cómo se elige la imagen

`core/images.js` hace matching por tags, no por texto libre.

**Entrada** → tags de tres fuentes:
1. `type` (`combat`, `puzzle`…) → expande a sinónimos canónicos
2. `system` + `setting` → tags de sistema
3. Palabras del `title` y `description` → normalizadas con `SYNONYMS` (ES→EN)

**Scoring**:
- Tipo: +3 (una vez, no por sinónimo)
- Sistema: +2
- Ambientación: +2
- Keywords de contenido: **× IDF** — un tag presente en 1 imagen vale mucho
  más que uno presente en 10
- Tiebreak: más keywords distintos; luego orden del manifest

El IDF es lo que hace que "aldea" (1 imagen) gane a "bosque" (4 imágenes).

**Threshold**: si la mejor puntuación es < 6, se cae a Pollinations con el
título real de la entidad. Preferimos una imagen genérica correcta a una
imagen buena pero equivocada.

### Sinónimos

`SYNONYMS` en `core/images.js` traduce español a los tags en inglés. Está
ajustado a mano al vocabulario de los packs actuales. Si importas packs con
vocabulario distinto, ampliarlo ahí.

## 3. Gradient CSS

Si no hay imagen (ni de librería ni de Pollinations), cada entidad tiene un
gradient determinista derivado de un hash de su nombre. La misma entidad tiene
siempre el mismo color; entidades distintas, colores distintos.

```js
fallbackGradient('thorin-123')
// → linear-gradient(135deg, hsl(14 55% 19%) 0%, hsl(83 55% 36%) 100%)
```

Se usa como `background` del elemento, así que aunque la imagen falle al
cargar, el color de fondo sigue ahí.

## Verificar el matching

```bash
node scripts/test-image-matching.mjs
```

10 casos reales extraídos de los packs, con el slug esperado. Si un cambio en
`SYNONYMS` o en el scoring rompe una elección, el check falla.

## Dónde se usan

| Sitio | Qué imagen |
|---|---|
| Home — game card | Portada de la partida |
| Game — banner de misión | Art de la misión |
| Game — banner de encuentro | Art del encounter actual |
| Gallery — character card | Retrato |

## Limitaciones

- **Precache = 1.4 MB.** Las 29 imágenes + 13 packs + assets. En la primera
  descarga móvil eso son ~400 KB con compresión HTTP. Si molesta, sacar las
  imágenes del precache y cargarlas lazy — se pierde offline.
- **Sin `srcset`.** Todo a 768×512 fijo. En móvil consume bandwidth de más en
  pantallas pequeñas.
- **Sin WebP.** JPEG everywhere. ~40 KB por imagen.
- **`dnd-forest-ambush` gana mucho.** Aparece en 3 de 10 casos de test porque es
  la única imagen de bosque genérico. Si se repite visualmente, añadir 2-3
  más de bosque (claro, winter, profundo) al manifest.
- **Pollinations puede caer.** Si el servicio desaparece, todo cae a gradient
  automáticamente. La librería sigue funcionando.