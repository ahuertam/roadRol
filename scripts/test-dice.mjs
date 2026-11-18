#!/usr/bin/env node
// Check del parser y la tirada de dados.
//
// El total de una tirada es lo que el master ve en pantalla: un parser que
// calcula mal no crashea, que da un numero equivocado en silencio. Esto es
// justo el tipo de logica que no se ve al usar la app.
//
// Uso: node scripts/test-dice.mjs
// Exit code 1 si falla.

const { parseDiceExpression, roll, rollAnimated } = await import('../src/core/dice.js')

let fail = 0

function check(label, ok) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) fail++
}

function throws(label, fn) {
  let threw = false
  try { fn() } catch { threw = true }
  check(label, threw)
}

console.log('parseo de expresiones')
{
  const a = parseDiceExpression('2d6')
  check('2d6 → 2 dados de 6 caras, sin modificador',
    a.count === 2 && a.sides === 6 && a.modifier === 0)

  const b = parseDiceExpression('1d20+5')
  check('1d20+5 → modificador +5',
    b.count === 1 && b.sides === 20 && b.modifier === 5)

  const c = parseDiceExpression('3d8-2')
  check('3d8-2 → modificador -2',
    c.count === 3 && c.sides === 8 && c.modifier === -2)

  const d = parseDiceExpression('  2D6  ')
  check('ignora espacios y mayúsculas', d.count === 2 && d.sides === 6)
}

console.log('\nexpresiones invalidas')
{
  throws('cadena vacía', () => parseDiceExpression(''))
  throws('sin numero de dados', () => parseDiceExpression('d6'))
  throws('separador equivocado', () => parseDiceExpression('2x6'))
  throws('texto suelto', () => parseDiceExpression('abc'))
  throws('sin caras', () => parseDiceExpression('2d'))
  throws('0 dados', () => parseDiceExpression('0d6'))
  throws('101 dados (maximo 100)', () => parseDiceExpression('101d6'))
  throws('1 cara (minimo 2)', () => parseDiceExpression('2d1'))
  throws('1001 caras (maximo 1000)', () => parseDiceExpression('2d1001'))
}

console.log('\ntirada')
{
  const r = roll('2d6')
  check('devuelve 2 dados', r.rolls.length === 2)
  check('cada dado entre 1 y 6', r.rolls.every(v => v >= 1 && v <= 6))
  check('el total es la suma de los dados', r.total === r.rolls.reduce((s, v) => s + v, 0))
  check('el total está entre 2 y 12', r.total >= 2 && r.total <= 12)

  const plus = roll('1d20+5')
  check('el modificador se suma al total', plus.total === plus.rolls[0] + 5)
  check('1d20+5 total entre 6 y 25', plus.total >= 6 && plus.total <= 25)

  const minus = roll('1d6-2')
  check('el modificador negativo resta', minus.total === minus.rolls[0] - 2)

  // ponytail: 200 tiradas para que un error de rango o de suma salte.
  const many = Array.from({ length: 200 }, () => roll('3d8+1'))
  check('200 tiradas: todos los dados en rango',
    many.every(r => r.rolls.every(v => v >= 1 && v <= 8)))
  check('200 tiradas: total siempre entre 4 y 25',
    many.every(r => r.total >= 4 && r.total <= 25))
}

console.log('\ntirada animada')
{
  // ponytail: rAF no existe en Node. Un polyfill de 1 linea para poder
  // comprobar que la promesa resuelve — de ese camino depende toda la UI.
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 1)
  const ticks = []
  const res = await rollAnimated('2d6', 20, (cur) => ticks.push(cur))
  check('resuelve con el resultado', res.total === res.rolls.reduce((s, v) => s + v, 0))
  check('emite al menos un tick', ticks.length > 0)
  check('el último tick coincide con el resultado',
    ticks[ticks.length - 1].total === res.total)
}

console.log(`\n${fail} fallo(s)`)
if (fail > 0) process.exit(1)
