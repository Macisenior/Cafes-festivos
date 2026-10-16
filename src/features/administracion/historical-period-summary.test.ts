import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { createHistoricalPeriodSummary } from './historical-period-summary'

const group: Group = { id: 'general', name: 'Grupo V4', isMainGroup: true, siteOptions: [] }
const people: readonly Person[] = [
  { id: 'mariano', groupId: 'general', name: 'Mariano', phone: '', isActive: false },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
]

function allFilters(from: string, to: string, personId = '') {
  return { from, to, personId, movementType: 'all' as const }
}

describe('resumen acumulado del PDF de Históricos', () => {
  it('reproduce el ejemplo de Mariano sin confundir el cierre con el saldo actual', () => {
    const contributions: readonly Contribution[] = [
      { id: 'opening', groupId: 'general', personId: 'mariano', date: null, amountInCents: 400, source: 'v3-opening' },
      { id: 'october', groupId: 'general', personId: 'mariano', date: '2026-10-01', amountInCents: 9000 },
      { id: 'future', groupId: 'general', personId: 'mariano', date: '2026-11-01', amountInCents: 5000 },
    ]
    const expenses: readonly Expense[] = [
      { id: 'october', groupId: 'general', date: '2026-10-31', siteName: 'Local', concept: 'Octubre', totalInCents: 7594, participantIds: ['mariano'], distribution: { mode: 'igual' }, allocations: [{ personId: 'mariano', amountInCents: 7594 }] },
    ]

    expect(createHistoricalPeriodSummary(group, people, contributions, expenses, allFilters('2026-10-01', '2026-10-31', 'mariano'))).toEqual({
      openingDate: '2026-09-30', closingDate: '2026-10-31', openingBalanceInCents: 400,
      contributionsInPeriodInCents: 9000, expensesInPeriodInCents: 7594,
      periodBalanceInCents: 1406, closingBalanceInCents: 1806,
    })
  })

  it('incluye ambos límites, excluye movimientos posteriores y admite saldos negativos', () => {
    const contributions: readonly Contribution[] = [
      { id: 'before', groupId: 'general', personId: 'mariano', date: '2026-09-30', amountInCents: 100 },
      { id: 'from', groupId: 'general', personId: 'mariano', date: '2026-10-01', amountInCents: 200 },
      { id: 'to', groupId: 'general', personId: 'mariano', date: '2026-10-31', amountInCents: 300 },
      { id: 'after', groupId: 'general', personId: 'mariano', date: '2026-11-01', amountInCents: 9999 },
    ]
    const expenses: readonly Expense[] = [
      { id: 'before', groupId: 'general', date: '2026-09-30', siteName: 'Local', concept: 'Antes', totalInCents: 250, participantIds: ['mariano'], distribution: { mode: 'igual' }, allocations: [{ personId: 'mariano', amountInCents: 250 }] },
      { id: 'from', groupId: 'general', date: '2026-10-01', siteName: 'Local', concept: 'Desde', totalInCents: 400, participantIds: ['mariano'], distribution: { mode: 'igual' }, allocations: [{ personId: 'mariano', amountInCents: 400 }] },
      { id: 'to', groupId: 'general', date: '2026-10-31', siteName: 'Local', concept: 'Hasta', totalInCents: 500, participantIds: ['mariano'], distribution: { mode: 'igual' }, allocations: [{ personId: 'mariano', amountInCents: 500 }] },
    ]

    expect(createHistoricalPeriodSummary(group, people, contributions, expenses, allFilters('2026-10-01', '2026-10-31', 'mariano'))).toMatchObject({
      openingBalanceInCents: -150, contributionsInPeriodInCents: 500, expensesInPeriodInCents: 900,
      periodBalanceInCents: -400, closingBalanceInCents: -550,
    })
  })

  it('conserva aperturas heredadas y personas inactivas en rangos históricos antiguos', () => {
    const contributions: readonly Contribution[] = [
      { id: 'opening', groupId: 'general', personId: 'mariano', date: null, amountInCents: 700, source: 'v3-opening' },
      { id: 'old', groupId: 'general', personId: 'mariano', date: '2001-01-01', amountInCents: 300 },
    ]
    expect(createHistoricalPeriodSummary(group, people, contributions, [], allFilters('2001-01-01', '2001-01-31', 'mariano'))).toMatchObject({
      openingDate: '2000-12-31', openingBalanceInCents: 700,
      contributionsInPeriodInCents: 300, closingBalanceInCents: 1000,
    })
  })

  it('mantiene el resumen clásico para rangos incompletos o tipos distintos de Todos', () => {
    expect(createHistoricalPeriodSummary(group, people, [], [], allFilters('', '2026-10-31'))).toBeNull()
    expect(createHistoricalPeriodSummary(group, people, [], [], { ...allFilters('2026-10-01', '2026-10-31'), movementType: 'expense' })).toBeNull()
  })
})
