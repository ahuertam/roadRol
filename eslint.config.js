// Flat config de ESLint. Sin reglas propias: solo `js.configs.recommended`
// (que incluye no-unused-vars y no-undef) más los globals de cada entorno.
//
// ponytail: si una regla suausta falsos positivos, se desactiva aqui con un
// comentario, no se resucita el fichero entero de configuración.

import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**'] },

  js.configs.recommended,

  {
    // App: browser
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser }
    }
  },
  {
    // Herramientas: node
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  }
]
