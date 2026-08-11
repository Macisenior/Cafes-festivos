/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const administrationPageSource = readFileSync(
  fileURLToPath(new URL('./AdministrationPage.tsx', import.meta.url)),
  'utf8',
)

describe('Pantalla 3 — Administración', () => {
  it('muestra el menú administrativo y los accesos a Personas, Grupos y Gastos', () => {
    expect(administrationPageSource).toContain('AdministrationMenu')
    expect(administrationPageSource).toContain("area === 'menu'")
    expect(administrationPageSource).toContain("area === 'people'")
    expect(administrationPageSource).toContain("area === 'groups'")
    expect(administrationPageSource).toContain("area === 'expenses'")
    expect(administrationPageSource).toContain("area === 'history'")
    expect(administrationPageSource).toContain("area === 'reports'")
    expect(administrationPageSource).toContain("area === 'expenses-by-person'")
    expect(administrationPageSource).toContain("area === 'contributions-by-person'")
    expect(administrationPageSource).toContain("area === 'global-wallet'")
    expect(administrationPageSource).toContain("area === 'account-state-at-date'")
    expect(administrationPageSource).toContain("area === 'pro-summary'")
  })

  it('reutiliza los componentes actuales en su propia área y permite volver al menú', () => {
    expect(administrationPageSource).toContain('CreatePersonForm')
    expect(administrationPageSource).toContain('PeopleList')
    expect(administrationPageSource).toContain('GroupList')
    expect(administrationPageSource).toContain('CreateGroupForm')
    expect(administrationPageSource).toContain('ExpenseDeletionAdmin')
    expect(administrationPageSource).toContain('Volver a Administración')
    expect(administrationPageSource).toContain('returnToAdministrationMenu')
  })

  it('mantiene Administración separada de los módulos operativos', () => {
    expect(administrationPageSource).not.toContain('AddCashContributionForm')
    expect(administrationPageSource).not.toContain('AddExpenseForm')
    expect(administrationPageSource).toContain('GroupOperationalHistory')
    expect(administrationPageSource).toContain('ExpensesByPersonReport')
    expect(administrationPageSource).toContain('ContributionsByPersonReport')
    expect(administrationPageSource).toContain('GlobalWalletSummary')
    expect(administrationPageSource).toContain('AccountStateAtDateReport')
    expect(administrationPageSource).toContain('ProSummaryReport')
    expect(administrationPageSource).toContain('groupName={entities.group.name}')
    expect(administrationPageSource).not.toContain('ExpenseEdit')
  })
})

