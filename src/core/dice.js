// Parser y roller de dados. Formato: NdM, NdM+X, NdM-X.
//   2d6, 1d20+5, 3d8-2, etc.
// Lanza una Promise con animación opcional; aquí solo el cálculo.

// ponytail: límites para que nadie se cuele con 9999d9999.
const MAX_DICE = 100
const MAX_SIDES = 1000

const EXPR_RE = /^(\d+)d(\d+)([+-]\d+)?$/i

/**
 * Parsea una expresión de dados. Lanza Error si es inválida.
 * @param {string} expression
 * @returns {{ count: number, sides: number, modifier: number, expression: string }}
 */
export function parseDiceExpression(expression) {
  const expr = String(expression || '').trim().toLowerCase()
  if (!expr) throw new Error('Expresión vacía')
  const m = expr.match(EXPR_RE)
  if (!m) throw new Error(`Expresión inválida: "${expression}". Usa formato NdM, ej. 2d6+3`)

  const count = parseInt(m[1], 10)
  const sides = parseInt(m[2], 10)
  const modifier = m[3] ? parseInt(m[3], 10) : 0

  if (count < 1) throw new Error('Mínimo 1 dado')
  if (count > MAX_DICE) throw new Error(`Máximo ${MAX_DICE} dados`)
  if (sides < 2) throw new Error('Los dados necesitan al menos 2 caras')
  if (sides > MAX_SIDES) throw new Error(`Máximo ${MAX_SIDES} caras`)

  return { count, sides, modifier, expression }
}

/**
 * Tira los dados. Devuelve los resultados.
 * @param {string} expression
 * @returns {{ expression: string, rolls: number[], modifier: number, sides: number, total: number }}
 */
export function roll(expression) {
  const { count, sides, modifier, expression: expr } = parseDiceExpression(expression)
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
  const total = rolls.reduce((s, r) => s + r, 0) + modifier
  return { expression: expr, rolls, modifier, sides, total }
}

/**
 * Tira con animación: muestra valores aleatorios intermedios durante `durationMs`
 * antes de mostrar el resultado real. Útil para dar feedback visual sin libs.
 * @param {string} expression
 * @param {number} durationMs
 * @param {(current: { rolls: number[], total: number }) => void} onTick
 * @returns {Promise<{ expression: string, rolls: number[], modifier: number, sides: number, total: number }>}
 */
export function rollAnimated(expression, durationMs = 600, onTick = null) {
  return new Promise((resolve) => {
    const result = roll(expression)
    const start = performance.now()

    function frame(now) {
      const elapsed = now - start
      if (elapsed >= durationMs) {
        onTick?.({ rolls: result.rolls, total: result.total })
        resolve(result)
        return
      }
      // Tira "falsa" solo para feedback visual
      const fakeRolls = result.rolls.map(() => 1 + Math.floor(Math.random() * result.sides))
      const fakeTotal = fakeRolls.reduce((s, r) => s + r, 0) + result.modifier
      onTick?.({ rolls: fakeRolls, total: fakeTotal })
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}
