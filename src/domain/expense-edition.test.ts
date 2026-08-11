import { describe, expect, it } from 'vitest'
import { editExpense, ExpenseDomainError } from './expenses'
import type { Contribution, Expense, Group, Person } from './entities'
import { createGroupFinancialView } from './financial-adapter'
import { FinancialDomainError } from './financial-engine'

const group: Group = {
  id: 'general',
  name: 'General',
  isMainGroup: true,
  siteOptions: [
    { id: 'flap', name: 'Flap' },
    { id: 'lydo', name: 'Lydo' },
  ],
}

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
  { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: false },
  { id: 'inactiva-nueva', groupId: 'general', name: 'Inactiva nueva', phone: '', isActive: false },
]

const originalExpense: Expense = {
  id: 'expense-1',
  groupId: 'general',
  date: '2026-08-09',
  siteName: 'Flap',
  concept: 'Original',
  totalInCents: 1000,
  participantIds: ['ana', 'pepe'],
  distribution: { mode: 'igual' },
  allocations: [
    { personId: 'ana', amountInCents: 500 },
    { personId: 'pepe', amountInCents: 500 },
  ],
}

function editInput(overrides = {}) {
  return {
    date: '2026-08-10',
    siteName: 'Lydo',
    concept: 'Editado',
    totalInCents: 1001,
    participantIds: ['ana', 'bea'],
    distribution: { mode: 'igual' as const },
    ...overrides,
  }
}

describe('edición de gastos V4', () => {
  it('sustituye fecha, sitio, concepto, importe y participantes conservando el mismo ID', () => {
    const updated = editExpense(group, people, [originalExpense], originalExpense.id, editInput())

    expect(updated).toMatchObject({
      id: 'expense-1',
      groupId: 'general',
      date: '2026-08-10',
      siteName: 'Lydo',
      concept: 'Editado',
      totalInCents: 1001,
      participantIds: ['ana', 'bea'],
      allocations: [
        { personId: 'ana', amountInCents: 501 },
        { personId: 'bea', amountInCents: 500 },
      ],
    })
  })

  it('recalcula un reparto por consumiciones mediante el motor', () => {
    const updated = editExpense(group, people, [originalExpense], originalExpense.id, editInput({
      totalInCents: 1000,
      distribution: { mode: 'consumiciones', consumptionsByPersonId: { ana: 2, bea: 1 } },
    }))

    expect(updated.allocations).toEqual([
      { personId: 'ana', amountInCents: 667 },
      { personId: 'bea', amountInCents: 333 },
    ])
  })

  it('conserva el reparto por importe individual cuando suma exactamente el total', () => {
    const updated = editExpense(group, people, [originalExpense], originalExpense.id, editInput({
      totalInCents: 1000,
      distribution: { mode: 'importe', amountsByPersonId: { ana: 600, bea: 400 } },
    }))

    expect(updated.allocations).toEqual([
      { personId: 'ana', amountInCents: 600 },
      { personId: 'bea', amountInCents: 400 },
    ])
  })

  it('rechaza importes individuales que no coinciden exactamente con el total', () => {
    expect(() => editExpense(group, people, [originalExpense], originalExpense.id, editInput({
      distribution: { mode: 'importe', amountsByPersonId: { ana: 400, bea: 400 } },
    }))).toThrow(FinancialDomainError)
  })

  it('permite mantener una participante histórica ahora inactiva', () => {
    const updated = editExpense(group, people, [originalExpense], originalExpense.id, editInput({
      participantIds: ['ana', 'pepe'],
      totalInCents: 1000,
    }))

    expect(updated.participantIds).toEqual(['ana', 'pepe'])
    expect(updated.allocations).toEqual([
      { personId: 'ana', amountInCents: 500 },
      { personId: 'pepe', amountInCents: 500 },
    ])
  })

  it('rechaza añadir a una nueva participante inactiva', () => {
    expect(() => editExpense(group, people, [originalExpense], originalExpense.id, editInput({
      participantIds: ['ana', 'inactiva-nueva'],
    }))).toThrow(ExpenseDomainError)
  })

  it('aísla la edición al gasto del grupo activo', () => {
    expect(() => editExpense({ ...group, id: 'otro-grupo' }, people, [originalExpense], originalExpense.id, editInput())).toThrow(
      ExpenseDomainError,
    )
  })

  it('no modifica aportaciones y los saldos se vuelven a derivar del gasto sustituido', () => {
    const contributions: readonly Contribution[] = [
      { id: 'contribution-ana', groupId: 'general', personId: 'ana', date: '2026-08-01', amountInCents: 1000 },
      { id: 'contribution-bea', groupId: 'general', personId: 'bea', date: '2026-08-01', amountInCents: 1000 },
    ]
    const updated = editExpense(group, people, [originalExpense], originalExpense.id, editInput({
      totalInCents: 1000,
      participantIds: ['ana', 'bea'],
    }))
    const financialView = createGroupFinancialView({
      group,
      people,
      contributions,
      expenses: [updated],
    })

    expect(contributions).toEqual([
      { id: 'contribution-ana', groupId: 'general', personId: 'ana', date: '2026-08-01', amountInCents: 1000 },
      { id: 'contribution-bea', groupId: 'general', personId: 'bea', date: '2026-08-01', amountInCents: 1000 },
    ])
    expect(financialView.personBalances).toEqual([
      expect.objectContaining({ personId: 'ana', availableInCents: 500 }),
      expect.objectContaining({ personId: 'bea', availableInCents: 500 }),
      expect.objectContaining({ personId: 'pepe', availableInCents: 0 }),
      expect.objectContaining({ personId: 'inactiva-nueva', availableInCents: 0 }),
    ])
    expect(financialView.groupBalance.availableInCents).toBe(1000)
  })
})
