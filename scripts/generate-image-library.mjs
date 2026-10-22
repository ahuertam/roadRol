#!/usr/bin/env node
// Genera la librería de imágenes base para RoadRol desde Pollinations.
// Lee public/images/library/manifest.json, hace fetch de cada imagen con retries
// y guarda en public/images/library/{slug}.jpg.
//
// Uso: node scripts/generate-image-library.mjs
//
// Opciones:
//   --dry    solo lista lo que haría, sin descargar
//   --only=X descarga solo el slug X (útil para reintentar uno fallido)

import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST = join(ROOT, 'public', 'images', 'library', 'manifest.json')
const OUT_DIR = join(ROOT, 'public', 'images', 'library')

const ARGS = process.argv.slice(2)
const DRY_RUN = ARGS.includes('--dry')
const ONLY = ARGS.find(a => a.startsWith('--only='))?.slice('--only='.length)

const WIDTH = 768
const HEIGHT = 512
// ponytail: el manifest dice defaultSize; por ahora hardcoded 768x512. Si cambia el
// manifest, leerlo aquí. Para v1 fijo.
const STYLE_SUFFIX = 'fantasy or horror art, atmospheric, no text, no logos, dramatic lighting'

// Backoff: si Pollinations 402/500, esperamos con jitter antes de reintentar
const MAX_RETRIES = 6
const BASE_DELAY_MS = 3000
const COOLDOWN_ON_402_MS = 30000  // ponytail: 402 es quota diaria, espera larga

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchOne(prompt, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', ' + STYLE_SUFFIX)}?width=${WIDTH}&height=${HEIGHT}&seed=${seed}&nologo=true`
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (resp.status === 200) {
        const buf = Buffer.from(await resp.arrayBuffer())
        if (buf.length < 1000) throw new Error(`Respuesta demasiado pequeña (${buf.length} bytes)`)
        return buf
      }
      // 402 (quota): cooldown largo. Otros 4xx/5xx: backoff exponencial.
      const delay = resp.status === 402
        ? COOLDOWN_ON_402_MS + Math.random() * 5000
        : BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500
      console.warn(`  attempt ${attempt}/${MAX_RETRIES} → ${resp.status}, retry in ${Math.round(delay / 1000)}s`)
      await sleep(delay)
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500
      console.warn(`  attempt ${attempt}/${MAX_RETRIES} → ${err.message}, retry in ${Math.round(delay / 1000)}s`)
      await sleep(delay)
    }
  }
  throw new Error('Max retries excedido')
}

async function exists(p) {
  try { await access(p); return true } catch { return false }
}

async function main() {
  const manifestRaw = await readFile(MANIFEST, 'utf8')
  const manifest = JSON.parse(manifestRaw)
  const images = ONLY ? manifest.images.filter(i => i.slug === ONLY) : manifest.images

  if (DRY_RUN) {
    console.log(`Would generate ${images.length} images into ${OUT_DIR}:`)
    for (const img of images) {
      console.log(`  - ${img.slug}.jpg  (${img.tags.length} tags)  →  ${img.prompt.slice(0, 60)}…`)
    }
    return
  }

  await mkdir(OUT_DIR, { recursive: true })

  let ok = 0, skip = 0, fail = 0
  for (const img of images) {
    const out = join(OUT_DIR, `${img.slug}.jpg`)
    if (await exists(out)) {
      console.log(`✓ ${img.slug}.jpg (cached, skip)`)
      skip++
      continue
    }
    const seed = img.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 100000
    process.stdout.write(`↓ ${img.slug}.jpg … `)
    try {
      const buf = await fetchOne(img.prompt, seed)
      await writeFile(out, buf)
      console.log(`OK (${(buf.length / 1024).toFixed(1)} KB)`)
      ok++
    } catch (err) {
      console.log(`FAIL: ${err.message}`)
      fail++
    }
    // Pausa entre requests para no agotar la quota
    await sleep(2000)
  }

  console.log(`\nDone. ok=${ok} skip=${skip} fail=${fail}`)
  if (fail > 0) {
    console.log(`Re-run with --only=SLUG para reintentar fallidos.`)
    process.exit(1)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
