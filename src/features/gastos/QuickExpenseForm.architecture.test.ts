/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./QuickExpenseForm.tsx', import.meta.url)), 'utf8')

describe('interfaz de Gasto rápido', () => {
  it('se mantiene separada de Firestore, del motor y de Añadir gasto', () => {
    expect(source).not.toContain('Firestore')
    expect(source).not.toContain('onGroupChanged')
    expect(source).not.toContain('createExpense')
    expect(source).toContain('Enviar por WhatsApp')
  })
})
