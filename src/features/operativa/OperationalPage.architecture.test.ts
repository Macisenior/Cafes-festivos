/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const operationalPageSource = readFileSync(
  fileURLToPath(new URL('./OperationalPage.tsx', import.meta.url)),
  'utf8',
)

describe('Pantalla 2 — Operativa', () => {
  it('compone operaciones V4 y reutiliza Gasto por sitio sin historial operativo', () => {
    expect(operationalPageSource).toContain('AddCashContributionForm')
    expect(operationalPageSource).toContain('AddExpenseForm')
    expect(operationalPageSource).toContain('QuickExpenseDisclosure')
    expect(operationalPageSource).not.toContain('QuickExpenseForm')
    expect(operationalPageSource).toContain('ExpensesBySite')
    expect(operationalPageSource).not.toContain('GroupOperationalHistory')
    expect(operationalPageSource).toContain('groupId={entities.group.id}')
  })

  it('reutiliza Estado de cuentas antes de Añadir efectivo con la vista financiera compartida', () => {
    expect(operationalPageSource).toContain('AccountStatusList')
    expect(operationalPageSource).toContain('financialView={financialView}')
    expect(operationalPageSource.indexOf('<AccountStatusList')).toBeLessThan(
      operationalPageSource.indexOf('<AddCashContributionForm'),
    )
  })
  it('no importa módulos administrativos ni operaciones de edición o eliminación', () => {
    expect(operationalPageSource).not.toContain('TemporaryExpenseAdmin')
    expect(operationalPageSource).not.toContain('AdministrationPage')
    expect(operationalPageSource).not.toContain('ExpenseDelete')
    expect(operationalPageSource).not.toContain('ExpenseEdit')
  })
})
