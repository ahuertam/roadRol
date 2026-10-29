# Contenido: packs de misiones

Un **pack** es un fichero JSON con misiones y encuentros prefabricados. El
master importa el pack, elige una misión al crear la partida, y va minerizando
encuentros con el botón *Siguiente*.

Hay 13 packs de ejemplo en `public/samples/` (25 misiones, 145 encuentros).

## Formato

```json
{
  "name": "La Mina Perdida (D&D 5e)",
  "system": "dnd5e",
  "setting": "fantasy",
  "missions": [
    {
      "id": "mina-1",
      "title": "Investigar la mina abandonada",
      "brief": "El pueblo de Robledo lleva una semana sin noticias del capataz…",
      "objectives": [
        "Encontrar al capataz Hiram",
        "Descubrir qué se mueve bajo tierra"
      ],
      "encounters": [
        {
          "type": "combat",
          "title": "Emboscada en el puente de madera",
          "description": "Tres goblins emboscados entre los troncos…",
          "difficulty": "easy",
          "rewards": "3d6 PO, daga curva con runas"
        }
      ]
    }
  ]
}
```

## Campos

### Pack

| Campo | Obligatorio | Notas |
|---|---|---|
| `name` | sí | Se muestra en la lista y en el wizard |
| `system` | sí | Debe existir en `modules/systems/` (`dnd5e`, `cthulhu`) |
| `setting` | no | Debe existir en `modules/settings/`. Si falta, el pack aplica a cualquier ambientación de su sistema |
| `missions` | sí | Array |

### Mission

| Campo | Obligatorio | Notas |
|---|---|---|
| `title` | sí | |
| `brief` | sí | Texto introductorio, se muestra bajo el banner de misión |
| `objectives` | no | Array de strings |
| `encounters` | sí | Array, se recorren en orden |

### Encounter

| Campo | Obligatorio | Notas |
|---|---|---|
| `type` | no | `combat` \| `puzzle` \| `trap` \| `conversation` \| `discovery`. Sin valor → `combat` |
| `title` | no | Si falta, se genera `Encuentro #N` |
| `description` | no | Editable inline por el master |
| `difficulty` | no | `easy` \| `medium` \| `hard` \| `deadly` |
| `rewards` | no | Se concatena a `masterNotes` |

## Validación

Al importar, `validatePack` comprueba:

- `name` y `system` presentes y con sistema registrado
- `setting` (si está) registrada
- Cada misión tiene `title`, `brief` y `encounters` array
- Cada encounter tiene `type` y `difficulty` dentro de los valores válidos

Si algo falla, el import se rechaza entero con un mensaje que dice exactamente
qué campo. No hay import parcial.

## Imágenes

Las imágenes **no van en el pack**. Se eligen automáticamente por matching de
tags (ver [imagenes.md](imagenes.md)) usando el `title` y la `description` del
encuentro más el `type`, `system` y `setting`.

Si algún día quieres control manual, el sitio natural es añadir un campo
`image` opcional con una URL absoluta — el matching por tags ya prioriza
correctamente los casos comunes y no lo necesita.

## Escribir un pack que funcione bien con el matching

El auto-tagging funciona con palabras clave del título y la descripción. Lo que
más ayuda:

- **Nombra el lugar**: "la cripta de los enanos", "el faro abandonado" → matchea
  con imágenes de cripta/faro en vez de genéricas
- **El tipo ayuda**: un encounter `trap` con "raíces" y "suelo" matchea mejor
  que uno sin tipo
- **Idioma coherente**: los `SYNONYMS` de `images.js` cubren español; si escribes
  en otro idioma el matching cae a la imagen por sistema/ambientación

## Compartir packs

Un pack es un `.json`. Se exporta a mano, se pasa por WhatsApp, se sube a donde
quieras. No hay galería de packs compartidos todavía.

## Limitación actual

Una partida consume **una** misión. Si quieres encadenar las 2 misiones de un
pack (como *Crónicas del Bosque Maldito*), tienes que crear una partida
distinta para la segunda. El `missionCursor` y los `encounters` son
independientes por partida.

Para soporte multi-misión haría falta un `game.missions[]` con encounter pools
por misión — es un cambio de modelo de datos, no de UI. Está en el backlog de
la fase 8 si algún día hace falta.