#!/usr/bin/env node
// E2E: verifica en un Chrome real los flujos que los checks de Node no ven.
//
// Arranca un Chrome headless contra el build de produccion, inyecta datos
// mal formados en IndexedDB y comprueba que la app no se rompe y que los
// avisos aparecen.
//
// Uso:
//   npm run build && npm run preview -- --port 4173 &
//   node scripts/e2e.mjs
//
// Exit code 1 si algun caso falla.

import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean)

const chromeBin = CHROME_CANDIDATES.find(p => existsSync(p))
if (!chromeBin) {
  console.error('No se encuentra Chrome. Define CHROME_PATH con la ruta al binario.')
  process.exit(1)
}

const PORT = Number(process.env.CDP_PORT || 9333)
const BASE = process.env.ROADROL_URL || 'http://localhost:4173'
const PROFILE = '/tmp/roadrol-e2e-profile'

rmSync(PROFILE, { recursive: true, force: true })
const chrome = spawn(chromeBin, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  // ponytail: el sandbox de Chrome no arranca como root (contenedores de CI).
  ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []),
  '--window-size=390,844', 'about:blank'
], { stdio: 'ignore' })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// La app se sirve aparte (npm run preview). Esperamos a que responda.
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/')
      if (r.ok) return
    } catch { /* todavia no responde */ }
    await sleep(250)
  }
  throw new Error(`El servidor ${BASE} no responde. ¿Está-running npm run preview?`)
}

async function waitForDevtools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (r.ok) return
    } catch { /* todavia no responde */ }
    await sleep(250)
  }
  throw new Error('Chrome no arrancó DevTools')
}

let fail = 0
function check(label, ok, extra = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`)
  if (!ok) fail++
}

let ws
try {
  await waitForServer()
  await waitForDevtools()

  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
  const target = await res.json()
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })

  let msgId = 0
  const pending = new Map()
  const consoleErrors = []

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map(a => a.value ?? a.description).join(' '))
    }
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
    }
  }

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++msgId
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) {
      throw new Error('JS: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    }
    return r.result.value
  }

  await send('Page.enable')
  await send('Runtime.enable')

  // ---- 1. La app carga ----
  console.log('\ncarga de la app')
  await send('Page.navigate', { url: BASE + '/' })
  for (let i = 0; i < 60; i++) {
    const ok = await evaluate(`document.readyState === 'complete' && !!document.querySelector('#app h1')`).catch(() => false)
    if (ok) break
    await sleep(200)
  }
  check('la app monta y pinta la home', await evaluate(`!!document.querySelector('#app h1')`))

  const charCount = await evaluate(`
    new Promise(async (res) => {
      const db = await new Promise((r, j) => { const q = indexedDB.open('roadrol'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error) })
      const q = db.transaction('characters', 'readonly').objectStore('characters').getAll()
      q.onsuccess = () => res(q.result.length)
      q.onerror = () => res(-1)
    })
  `)
  check('el seed metió los personajes de ejemplo', charCount >= 2, `n=${charCount}`)

  // ---- 2. Inyectar una partida mal formada + un personaje de CoC ----
  console.log('\ninyección de datos')
  const seeded = await evaluate(`
    new Promise(async (res, rej) => {
      const db = await new Promise((r, j) => { const q = indexedDB.open('roadrol'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error) })
      const now = new Date().toISOString()
      const tx = db.transaction(['games', 'characters'], 'readwrite')
      tx.objectStore('games').put({
        id: 'test-malformed', name: 'Partida Rota', system: 'dnd5e', setting: 'fantasy',
        status: 'active', characters: ['fantasma-inexistente'], mission: null,
        encounters: [{ id: 'e-mal', title: 'Encuentro sin rollHistory' }],
        currentEncounterId: 'e-mal', createdAt: now, updatedAt: now
      })
      tx.objectStore('characters').put({
        id: 'test-coc', name: 'Whately', system: 'cthulhu', setting: 'horror',
        stats: { hp: 11, maxHp: 11, san: 55, maxSan: 99 },
        notes: '', createdAt: now, updatedAt: now
      })
      tx.oncomplete = () => res(true)
      tx.onerror = () => rej(tx.error)
    })
  `)
  check('se inyectaron la partida rota y el personaje de CoC', seeded === true)

  // ---- 3. La partida mal formada se abre sin reventar ----
  console.log('\npartida importada a mano')
  await evaluate(`location.hash = '#/game/test-malformed'`)
  await sleep(1200)
  const gameHtml = await evaluate(`document.querySelector('#app').innerHTML`)
  check('la pantalla de partida no muestra un error', !gameHtml.includes('Error:'))
  check('no aparece "undefined" en el DOM', !gameHtml.includes('undefined'))
  check('no aparece "NaN" en el DOM', !gameHtml.includes('NaN'))
  check('se ve el nombre de la partida', gameHtml.includes('Partida Rota'))
  check('se ve el encuentro sin rollHistory', gameHtml.includes('Encuentro sin rollHistory'))
  check('el feed de tiradas no revienta', gameHtml.includes('Sin tiradas'))
  check('avisa del personaje que no existe', gameHtml.includes('no están en este dispositivo'))

  // ---- 4. La galería deja editar el SAN en línea ----
  console.log('\ngalería: edición inline del SAN')
  await evaluate(`location.hash = '#/gallery'`)
  await sleep(1500)
  const gal = await evaluate(`document.querySelector('#app').innerHTML`)
  check('la galería muestra la tarjeta de Whately', gal.includes('Whately'))
  check('la tarjeta muestra SAN', gal.includes('SAN'))
  check('el SAN usa data-edit-stat', await evaluate(`document.querySelectorAll('[data-edit-stat="san"]').length`) === 1)

  await evaluate(`document.querySelector('[data-edit-stat="san"]').click()`)
  await sleep(200)
  check('al hacer clic aparece un input', await evaluate(`!!document.querySelector('[data-edit-stat="san"] input')`) === true)

  await evaluate(`
    (() => {
      const input = document.querySelector('[data-edit-stat="san"] input')
      input.value = '42'
      input.dispatchEvent(new Event('blur'))
    })()
  `)
  await sleep(800)
  const san = await evaluate(`
    new Promise(async (res) => {
      const db = await new Promise((r, j) => { const q = indexedDB.open('roadrol'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error) })
      const q = db.transaction('characters', 'readonly').objectStore('characters').get('test-coc')
      q.onsuccess = () => res(q.result?.stats?.san)
      q.onerror = () => res('error')
    })
  `)
  check('el SAN se guardó como 42', san === 42, `san=${san}`)

  // ---- 5. Importar los packs de ejemplo ----
  console.log('\nimportar packs de ejemplo')
  await evaluate(`location.hash = '#/packs'`)
  await sleep(1200)
  check('la pantalla de packs tiene el botón de samples',
    await evaluate(`!!document.querySelector('[data-import-samples]')`) === true)
  await evaluate(`document.querySelector('[data-import-samples]').click()`)

  const countPacks = `
    new Promise(async (res) => {
      const db = await new Promise((r, j) => { const q = indexedDB.open('roadrol'); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error) })
      const q = db.transaction('packs', 'readonly').objectStore('packs').getAll()
      q.onsuccess = () => res(q.result.length)
      q.onerror = () => res(-1)
    })
  `
  let packCount = 0
  for (let i = 0; i < 30 && packCount !== 13; i++) {
    await sleep(400)
    packCount = await evaluate(countPacks)
  }
  check('se importaron los 13 packs de ejemplo', packCount === 13, `n=${packCount}`)
  check('la UI muestra las 13 tarjetas de pack',
    await evaluate(`document.querySelectorAll('.pack-card').length`) === 13)

  // ---- 6. La partida sigue abrirse después de editar ----
  console.log('\npersistencia')
  await evaluate(`location.hash = '#/game/test-malformed'`)
  await sleep(1200)
  check('la partida vuelve a abrir sin error', !(await evaluate(`document.querySelector('#app').innerHTML`)).includes('Error:'))

  // ---- 7. Sin errores JS en consola ----
  check('sin errores JS capturados', consoleErrors.length === 0, consoleErrors.join(' | '))
} catch (err) {
  console.error('\nE2E roto:', err.message)
  fail++
} finally {
  chrome.kill()
}

console.log(`\n${fail} fallo(s)`)
process.exit(fail > 0 ? 1 : 0)
