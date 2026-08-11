/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cashSource = readFileSync(fileURLToPath(new URL('../aportaciones/AddCashContributionForm.tsx', import.meta.url)), 'utf8')
const expenseSource = readFileSync(fileURLToPath(new URL('../gastos/AddExpenseForm.tsx', import.meta.url)), 'utf8')

describe('escrituras operativas mediante Functions', () => {
  it('Añadir efectivo no importa la persistencia Firestore directa de aportaciones', () => {
    expect(cashSource).toContain('FirestoreV4OperationalFunctionsClient')
    expect(cashSource).not.toContain('FirestoreV4ContributionPersistence')
    expect(cashSource).not.toContain('FirestoreV4ContributionService')
  })

  it('Añadir gasto no importa la persistencia Firestore directa ni calcula su reparto', () => {
    expect(expenseSource).toContain('FirestoreV4OperationalFunctionsClient')
    expect(expenseSource).not.toContain('FirestoreV4ExpensePersistence')
    expect(expenseSource).not.toContain('FirestoreV4ExpenseService')
    expect(expenseSource).not.toContain("import { createExpense }")
  })
})
