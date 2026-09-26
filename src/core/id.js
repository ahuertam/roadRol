// crypto.randomUUID está disponible en todos los navegadores modernos (2022+).
// ponytail: no usamos librería — un wrapper no aporta nada aquí.
export const newId = () => crypto.randomUUID()
