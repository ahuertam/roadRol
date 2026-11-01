#!/usr/bin/env node
// Check del generador de IDs.
//
// Crypto.randomUUID() solo existe en contextos seguros (HTTPS o localhost).
// Sobre http://192.168.x.x:5173 — como se prueba en el movil — no existe y
// la app se rompia al no poder generar IDs ni para el seed ni para guardar.
//
// Este check simula un contexto inseguro quitando randomUUID y comprueba que
// el fallback devuelve un UUID v4 con el formato correcto.
//
// Uso: node scripts/test-id.mjs
// Exit code 1 si falla.

const { newId } = await import('../src/core/id.js')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let fail = 0

function check(label, ok) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) fail++
}

console.log('contexto seguro (randomUUID disponible)')
{
  const id = newId()
  check('devuelve un UUID con formato v4', UUID_RE.test(id))
  check('no repite dos ids seguidos', newId() !== id)
}

console.log('\ncontexto inseguro (randomUUID ausente)')
{
  const original = crypto.randomUUID
  // ponytail: el navegador no deja borrar randomUUID (es read-only), asi que
  // lo falseamos temporalmente para simular el entorno sin secure context.
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
  try {
    const id = newId()
    check('el fallback devuelve un UUID con formato v4', UUID_RE.test(id))
    check('genera 100 ids distintos', new Set(Array.from({ length: 100 }, newId)).size === 100)
    check('la versión es 4', id[14] === '4')
    check('la variante es 8, 9, a o b', '89ab'.includes(id[19]))
  } finally {
    Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
  }
}

console.log(`\n${fail} fallo(s)`)
if (fail > 0) process.exit(1)
