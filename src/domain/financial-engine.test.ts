import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Group } from './entities'
import {
  calculateExpenseAllocations,
  calculateGlobalBalance,
  calculateGroupBalance,
  calculatePersonBalance,
  calculateTotalContributedByPerson,
  checkExpenseIntegrity,
  checkGlobalIntegrity,
  checkGroupIntegrity,
  checkPersonIntegrity,
} from './financial-engine'

const baseExpense = (overrides: Partial<Expense>): Expense => ({
  id: 'expense-1',
  groupId: 'group-1',
  date: '2026-08-09',
  concept: 'Prueba',
  siteName: 'Flap',
  totalInCents: 0,
  participantIds: [],
  distribution: { mode: 'igual' },
  allocations: [],
  ...overrides,
})

describe('calculateExpenseAllocations', () => {
  it('reparte Igual en céntimos y asigna el céntimo restante de forma determinista', () => {
    const expense = baseExpense({
      totalInCents: 1000,
      participantIds: ['ana', 'bea', 'carlos'],
    })

    expect(calculateExpenseAllocations(expense)).toEqual([
      { personId: 'ana', amountInCents: 334 },
      { personId: 'bea', amountInCents: 333 },
      { personId: 'carlos', amountInCents: 333 },
    ])
  })

  it('reparte Consumiciones de forma proporcional y exacta', () => {
    const expense = baseExpense({
      totalInCents: 6000,
      participantIds: ['ana', 'bea', 'carlos'],
      distribution: {
        mode: 'consumiciones',
        consumptionsByPersonId: { ana: 3, bea: 2, carlos: 1 },
      },
    })

    expect(calculateExpenseAllocations(expense)).toEqual([
      { personId: 'ana', amountInCents: 3000 },
      { personId: 'bea', amountInCents: 2000 },
      { personId: 'carlos', amountInCents: 1000 },
    ])
  })

  it('acepta Importe por persona solo cuando suma exactamente el total', () => {
    const expense = baseExpense({
      totalInCents: 6000,
      participantIds: ['ana', 'bea', 'carlos'],
      distribution: {
        mode: 'importe',
        amountsByPersonId: { ana: 2500, bea: 2000, carlos: 1500 },
      },
    })

    expect(calculateExpenseAllocations(expense)).toEqual([
      { personId: 'ana', amountInCents: 2500 },
      { personId: 'bea', amountInCents: 2000 },
      { personId: 'carlos', amountInCents: 1500 },
    ])
  })
})

describe('balances e integridad', () => {
  const groups: Group[] = [
    { id: 'group-1', name: 'Grupo 1', isMainGroup: true, siteOptions: [] },
    { id: 'group-2', name: 'Grupo 2', isMainGroup: false, siteOptions: [] },
  ]
  const contributions: Contribution[] = [
    { id: 'c-1', groupId: 'group-1', personId: 'ana', date: '2026-08-01', amountInCents: 5000 },
    { id: 'c-2', groupId: 'group-1', personId: 'bea', date: '2026-08-01', amountInCents: 3000 },
    { id: 'c-3', groupId: 'group-2', personId: 'carlos', date: '2026-08-01', amountInCents: 2000 },
  ]
  const expenses: Expense[] = [
    baseExpense({
      id: 'e-1',
      totalInCents: 3000,
      participantIds: ['ana', 'bea'],
      allocations: [
        { personId: 'ana', amountInCents: 1500 },
        { personId: 'bea', amountInCents: 1500 },
      ],
    }),
    baseExpense({
      id: 'e-2',
      groupId: 'group-2',
      totalInCents: 500,
      participantIds: ['carlos'],
      distribution: { mode: 'importe', amountsByPersonId: { carlos: 500 } },
      allocations: [{ personId: 'carlos', amountInCents: 500 }],
    }),
  ]

  it('calcula aportado y saldos personales desde movimientos y repartos guardados', () => {
    const anaBalance = calculatePersonBalance('ana', 'group-1', contributions, expenses)
    const beaBalance = calculatePersonBalance('bea', 'group-1', contributions, expenses)

    expect(calculateTotalContributedByPerson('ana', contributions)).toBe(5000)
    expect(anaBalance).toMatchObject({ contributedInCents: 5000, spentInCents: 1500, availableInCents: 3500 })
    expect(beaBalance).toMatchObject({ contributedInCents: 3000, spentInCents: 1500, availableInCents: 1500 })
    expect(checkPersonIntegrity(anaBalance).isConsistent).toBe(true)
    expect(checkExpenseIntegrity(expenses[0]).isConsistent).toBe(true)
  })

  it('conserva una aportación histórica de corrección en céntimos', () => {
    expect(
      calculateTotalContributedByPerson('ana', [
        { id: 'c-4', groupId: 'group-1', personId: 'ana', date: '2026-08-02', amountInCents: 1000 },
        { id: 'c-5', groupId: 'group-1', personId: 'ana', date: '2026-08-03', amountInCents: -200 },
      ]),
    ).toBe(800)
  })

  it('calcula saldos de grupo y globales consistentes', () => {
    const anaBalance = calculatePersonBalance('ana', 'group-1', contributions, expenses)
    const beaBalance = calculatePersonBalance('bea', 'group-1', contributions, expenses)
    const groupBalance = calculateGroupBalance('group-1', contributions, expenses)
    const globalBalance = calculateGlobalBalance(groups, contributions, expenses)

    expect(groupBalance).toMatchObject({ contributedInCents: 8000, spentInCents: 3000, availableInCents: 5000 })
    expect(globalBalance.availableInCents).toBe(6500)
    expect(checkGroupIntegrity(groupBalance, [anaBalance, beaBalance]).isConsistent).toBe(true)
    expect(checkGlobalIntegrity(globalBalance).isConsistent).toBe(true)
  })
})
