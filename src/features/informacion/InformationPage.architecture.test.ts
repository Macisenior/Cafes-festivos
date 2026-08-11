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

  it('mantiene las consultas ligadas al grupo activo y delega el estado compartido al contenedor', () => {
    expect(informationPageSource).toContain('ActiveGroupSelector')
    expect(informationPageSource).toContain('<ExpensesBySite groupId={entities.group.id}')
    expect(informationPageSource).toContain('AccountStatusList')
    expect(informationPageSource).toContain('onSelectPerson')
    expect(informationPageSource).toContain('GlobalWalletSummary')
  })
})
