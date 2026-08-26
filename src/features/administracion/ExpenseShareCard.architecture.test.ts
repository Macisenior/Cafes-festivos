/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ExpenseShareCard.tsx', import.meta.url)), 'utf8')

describe('composición de la tarjeta PNG de gasto', () => {
  it('incluye únicamente el contenido útil y excluye controles del modal', () => {
    expect(source).toContain('GASTOS DEL GRUPO')
    expect(source).toContain('Participantes y asignación final')
    expect(source).not.toContain('Cerrar')
    expect(source).not.toContain('<button')
    expect(source).not.toContain('onClick')
  })
})