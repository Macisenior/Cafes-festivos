import { describe, expect, it } from 'vitest'
import type { Expense, Person } from '../../domain/entities'
import { createExpensesByPersonReport } from './expenses-by-person'

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: false },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
  { id: 'carlos', groupId: 'general', name: 'Carlos', phone: '', isActive: true },
  { id: 'otro', groupId: 'otro', name: 'Otro', phone: '', isActive: true },
]

const expenses: readonly Expense[] = [
  { id: 'equal', groupId: 'general', date: '2026-08-01', siteName: 'Flap', concept: 'Igual', totalInCents: 1001, participantIds: ['ana', 'bea', 'carlos'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 334 }, { personId: 'bea', amountInCents: 333 }, { personId: 'carlos', amountInCents: 334 }] },
  { id: 'consumptions', groupId: 'general', date: '2026-08-05', siteName: 'Lydo', concept: 'Consumiciones', totalInCents: 900, participantIds: ['ana', 'bea'], distribution: { mode: 'consumiciones', consumptionsByPersonId: { ana: 2, bea: 1 } }, allocations: [{ personId: 'ana', amountInCents: 600 }, { personId: 'bea', amountInCents: 300 }] },
  { id: 'individual', groupId: 'general', date: '2026-08-10', siteName: 'Flap', concept: 'Importes', totalInCents: 700, participantIds: ['bea', 'carlos'], distribution: { mode: 'importe', amountsByPersonId: { bea: 250, carlos: 450 } }, allocations: [{ personId: 'bea', amountInCents: 250 }, { personId: 'carlos', amountInCents: 450 }] },
  { id: 'other', groupId: 'otro', date: '2026-08-10', siteName: 'Otro', concept: 'Otro', totalInCents: 999, participantIds: ['otro'], distribution: { mode: 'igual' }, allocations: [{ personId: 'otro', amountInCents: 999 }] },
]

describe('informe Gastos por persona', () => {
  it('suma únicamente las asignaciones reales de Igual, Consumiciones e Importe por persona', () => {
    const report = createExpensesByPersonReport('general', people, expenses)

    expect(report.people).toEqual([
      expect.objectContaining({ personId: 'ana', spentInCents: 934, isActive: false }),
      expect.objectContaining({ personId: 'bea', spentInCents: 883 }),
      expect.objectContaining({ personId: 'carlos', spentInCents: 784 }),
    ])
    expect(report.totalExpensesInCents).toBe(2601)
    expect(report.totalAssignedInCents).toBe(2601)
  })

  it('conserva a una persona inactiva con su consumo histórico', () => {
    expect(createExpensesByPersonReport('general', people, expenses).people[0]).toMatchObject({ personName: 'Ana', isActive: false, spentInCents: 934 })
  })

  it('aplica Desde, Hasta y ambos extremos de forma inclusiva', () => {
    expect(createExpensesByPersonReport('general', people, expenses, { from: '2026-08-05', to: '2026-08-10' }).totalExpensesInCents).toBe(1600)
    expect(createExpensesByPersonReport('general', people, expenses, { from: '2026-08-05', to: '' }).totalExpensesInCents).toBe(1600)
    expect(createExpensesByPersonReport('general', people, expenses, { from: '', to: '2026-08-05' }).totalExpensesInCents).toBe(1901)
  })

  it('aísla el grupo activo y permite un estado vacío', () => {
    expect(createExpensesByPersonReport('otro', people, expenses).totalExpensesInCents).toBe(999)
    expect(createExpensesByPersonReport('vacío', people, expenses).people).toEqual([])
    expect(createExpensesByPersonReport('vacío', people, expenses).totalExpensesInCents).toBe(0)
  })
})
