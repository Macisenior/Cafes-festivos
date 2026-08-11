/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./QuickExpenseDisclosure.tsx', import.meta.url)), 'utf8')
const informationPageSource = readFileSync(fileURLToPath(new URL('./InformationPage.tsx', import.meta.url)), 'utf8')

describe('acceso de Gasto rápido en Información', () => {
  it('reutiliza el formulario existente y permanece fuera de Firestore y de las operaciones financieras', () => {
    expect(source).toContain('QuickExpenseForm')
    expect(source).toContain('embedded')
    expect(source).not.toContain('Firestore')
    expect(source).not.toContain('setDoc')
    expect(source).not.toContain('createExpense')
  })

  it('lo compone al final de la pantalla de Información sin alterar el resto de las áreas', () => {
    expect(informationPageSource).toContain('QuickExpenseDisclosure')
    expect(informationPageSource.indexOf('ExpensesBySite')).toBeLessThan(informationPageSource.lastIndexOf('QuickExpenseDisclosure'))
  })
})
