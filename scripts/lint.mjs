#!/usr/bin/env node
// Lint del repo.
//
// Si hay eslint instalado (devDependency) se usa `eslint .` con el flat
// config de eslint.config.js. Si no, cae a `node --check` sobre cada JS.
//
// ponytail: el fallback existe para que `npm run lint` y el CI no dependan de
// una devDependency concreta. Con eslint: no-unused-vars y no-undef. Sin
// eslint: solo errores de sintaxis, que es lo que rompia la app.
//
// Uso: node scripts/lint.mjs
// Exit code 1 si algo falla.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIRS = ['src', 'scripts']
const SKIP = new Set(['node_modules', 'dist', 'dev-dist', '.git', 'coverage'])

const ESLINT_BIN = join(ROOT, 'node_modules', '.bin', 'eslint')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(js|mjs)$/.test(entry)) out.push(full)
  }
  return out
}

let fail = 0

if (existsSync(ESLINT_BIN)) {
  console.log('eslint .')
  try {
    execFileSync(ESLINT_BIN, ['.'], { cwd: ROOT, stdio: 'inherit' })
  } catch {
    fail++
  }
} else {
  console.log('eslint no está instalado — fallback a `node --check`')
  let count = 0
  for (const dir of DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      count++
      try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
      } catch (err) {
        fail++
        console.error(`✗ ${relative(ROOT, file)}`)
        console.error(String(err.stderr || err.message).trim())
        console.error('')
      }
    }
  }
  console.log(`${count} fichero(s) revisados, ${fail} con errores de sintaxis`)
}

if (fail > 0) process.exit(1)
