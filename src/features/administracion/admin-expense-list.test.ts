import { describe, expect, it } from 'vitest'
import type { Expense, Person } from '../../domain/entities'
import { compactExpenseParticipants, expenseAllocationDetails, visibleAdminExpenses } from './admin-expense-list'

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: false },
  { id: 'carlos', groupId: 'general', name: 'Carlos', phone: '', isActive: true },
  { id: 'dani', groupId: 'general', name: 'Dani', phone: '', isActive: true },
]
const expenses: readonly Expense[] = [
  { id: 'old', groupId: 'general', date: '2026-07-31', siteName: 'Flap', concept: 'Antiguo', totalInCents: 100, participantIds: ['ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 100 }] },
  { id: 'recent', groupId: 'general', date: '2026-08-10', siteName: 'Lydo', concept: 'Reciente', totalInCents: 1001, participantIds: ['ana', 'bea', 'carlos', 'dani'], distribution: { mode: 'consumiciones', consumptionsByPersonId: { ana: 2, bea: 1, carlos: 1, dani: 1 } }, allocations: [{ personId: 'ana', amountInCents: 401 }, { personId: 'bea', amountInCents: 200 }, { personId: 'carlos', amountInCents: 200 }, { personId: 'dani', amountInCents: 200 }] },
  { id: 'earlier', groupId: 'general', date: '2026-08-02', siteName: 'Colono', concept: 'Anterior', totalInCents: 300, participantIds: ['ana', 'bea'], distribution: { mode: 'importe', amountsByPersonId: { ana: 200, bea: 100 } }, allocations: [{ personId: 'ana', amountInCents: 200 }, { personId: 'bea', amountInCents: 100 }] },
  { id: 'other-group', groupId: 'otro', date: '2026-08-10', siteName: 'Otro', concept: 'Aislado', totalInCents: 500, participantIds: [], distribution: { mode: 'igual' }, allocations: [] },
]

describe('vista administrativa compacta de gastos', () => {
  it('muestra por defecto el mes actual, ordenado de más reciente a más antiguo, y permite ver todos', () => {
    const now = new Date(2026, 7, 10)
    expect(visibleAdminExpenses(expenses, 'general', 'current-month', now).map((expense) => expense.id)).toEqual(['recent', 'earlier'])
    expect(visibleAdminExpenses(expenses, 'general', 'all', now).map((expense) => expense.id)).toEqual(['recent', 'earlier', 'old'])
  })

  it('prepara participantes compactos y conserva las asignaciones reales para el detalle', () => {
    expect(compactExpenseParticipants(expenses[1], people)).toEqual({ visibleNames: ['Ana', 'Bea', 'Carlos'], extraCount: 1 })
    expect(expenseAllocationDetails(expenses[1], people)).toEqual([
      { personId: 'ana', personName: 'Ana', amountInCents: 401 },
      { personId: 'bea', personName: 'Bea', amountInCents: 200 },
      { personId: 'carlos', personName: 'Carlos', amountInCents: 200 },
      { personId: 'dani', personName: 'Dani', amountInCents: 200 },
    ])
  })
})
