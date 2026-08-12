/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const informationPageSource = readFileSync(
  fileURLToPath(new URL('./InformationPage.tsx', import.meta.url)),
  'utf8',
)

describe('Pantalla 1 — Información', () => {
  it('solo compone consulta y no integra operaciones de escritura ni administración', () => {
    expect(informationPageSource).not.toContain('AddCashContributionForm')
    expect(informationPageSource).not.toContain('AddExpenseForm')
    expect(informationPageSource).not.toContain('TemporaryExpenseAdmin')
    expect(informationPageSource).not.toContain('ExpenseDeletionAdmin')
    expect(informationPageSource).not.toContain('GroupOperationalHistory')
    expect(informationPageSource).not.toContain('setDoc')
    expect(informationPageSource).not.toContain('updateDoc')
    expect(informationPageSource).not.toContain('deleteDoc')
  })

  it('muestra grupo como información de consulta y solo solicita la identificación inicial cuando falta', () => {
    expect(informationPageSource).toContain('information-active-group')
    expect(informationPageSource).toContain('{entities.group.name}')
    expect(informationPageSource).toContain('selectedPerson?.name')
    expect(informationPageSource).not.toContain('ActiveGroupSelector')
    expect(informationPageSource).not.toContain('Cambiar usuario')
    expect(informationPageSource).not.toContain('onChangeGroup')
    expect(informationPageSource).toContain('selectedPerson === null')
    expect(informationPageSource).toContain('onSelectInitialPerson')
    expect(informationPageSource).toContain('person.isActive')
  })

  it('mantiene las consultas financieras existentes vinculadas al grupo actual', () => {
    expect(informationPageSource).toContain('<ExpensesBySite groupId={entities.group.id}')
    expect(informationPageSource).toContain('AccountStatusList')
    expect(informationPageSource).toContain('GlobalWalletSummary')
  })
})
