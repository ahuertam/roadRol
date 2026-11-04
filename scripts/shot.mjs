#!/usr/bin/env node
// Captura una pantalla de RoadRol por CDP y vuelca los errores de consola.
//
// Uso: node scripts/shot.mjs <ruta-hash> [nombre-fichero] [ancho] [alto]
//   node scripts/shot.mjs /            home
//   node scripts/shot.mjs /gallery     gallery
//   node scripts/shot.mjs /setup       setup
//
// Necesita un Chrome headless ya arrancado con --remote-debugging-port=9222.

import { writeFileSync } from 'node:fs'

const [, , hash = '/', name = 'shot', w = '390', h = '844'] = process.argv
const BASE = process.env.ROADROL_URL || 'http://192.168.31.67:5173'
const PORT = process.env.CDP_PORT || '9222'

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
let page = targets.find(t => t.type === 'page')
if (!page) {
  page = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`)).json()
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const logs = []

const send = (method, params = {}) =>
  new Promise(resolve => {
    const msgId = ++id
    pending.set(msgId, resolve)
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result)
    pending.delete(msg.id)
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(`[${msg.params.type}] ${msg.params.args.map(a => a.value ?? a.description ?? '').join(' ')}`)
  } else if (msg.method === 'Runtime.exceptionThrown') {
    logs.push(`[EXCEPTION] ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`)
  }
}

await new Promise(r => { ws.onopen = r })

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(w), height: Number(h), deviceScaleFactor: 2, mobile: true
})

await send('Page.navigate', { url: BASE + '/#' + hash })
await new Promise(r => setTimeout(r, 3500))

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
writeFileSync(`/tmp/roadrol-${name}.png`, Buffer.from(shot.data, 'base64'))

const dom = await send('Runtime.evaluate', {
  expression: 'document.getElementById("app").innerHTML.length + " chars en #app"',
  returnByValue: true
})

console.log(`/tmp/roadrol-${name}.png  ·  ${dom.result.value}`)
if (logs.length) {
  console.log('--- consola ---')
  logs.forEach(l => console.log('  ' + l))
}

ws.close()
process.exit(0)
