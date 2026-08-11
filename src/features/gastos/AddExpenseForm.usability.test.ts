/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./AddExpenseForm.tsx', import.meta.url)), 'utf8')

describe('usabilidad de Añadir gasto', () => {
  it('usa los estados existentes para chips de sitio y participantes', () => {
    expect(source).toContain("['Flap', 'Colono', 'Lydo']")
    expect(source).toContain('setSiteName(site)')
    expect(source).toContain('setSelectedMainSite(null)')
    expect(source).toContain('expense-participant-chip')
    expect(source).toContain('toggleParticipant(person.id, event.target.checked)')
    expect(source).toContain('Seleccionar todos')
  })

  it('envía el borrador a la Function operativa sin importar persistencia Firestore directa', () => {
    expect(source).toContain('FirestoreV4OperationalFunctionsClient')
    expect(source).toContain('.createExpense(operationalPin')
    expect(source).not.toContain('FirestoreV4ExpenseService')
  })
})