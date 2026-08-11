import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Group, Person } from './entities'
import { createGlobalFinancialView, createGroupFinancialView } from './financial-adapter'

const mainGroup: Group = {
  id: 'group-main',
  name: 'Grupo principal',
  isMainGroup: true,
  siteOptions: [],
}

const people: Person[] = [
  { id: 'ana', groupId: 'group-main', name: 'Ana', phone: '600000001', isActive: true },
  { id: 'bea', groupId: 'group-main', name: 'Bea', phone: '600000002', isActive: true },
  { id: 'carlos', groupId: 'group-main', name: 'Carlos', phone: '600000003', isActive: false },
]

const contributions: Contribution[] = [
  { id: 'contribution-1', groupId: 'group-main', personId: 'ana', date: '2026-08-01', amountInCents: 10000 },
  { id: 'contribution-2', groupId: 'group-main', personId: 'bea', date: '2026-08-01', amountInCents: 10000 },
  { id: 'contribution-3', groupId: 'group-main', personId: 'carlos', date: '2026-08-01', amountInCents: 10000 },
]

const expenses: Expense[] = [
  {
    id: 'expense-equal',
    groupId: 'group-main',
    date: '2026-08-02',
    concept: 'Gasto igual',
    siteName: 'Flap',
    totalInCents: 1001,
    participantIds: ['ana', 'bea', 'carlos'],
    distribution: { mode: 'igual' },
    allocations: [
      { personId: 'ana', amountInCents: 334 },
      { personId: 'bea', amountInCents: 334 },
      { personId: 'carlos', amountInCents: 333 },
    ],
  },
  {
    id: 'expense-consumptions',
    groupId: 'group-main',
    date: '2026-08-03',
    concept: 'Gasto por consumiciones',
    siteName: 'Colono',
    totalInCents: 6000,
    participantIds: ['ana', 'bea', 'carlos'],
    distribution: {
      mode: 'consumiciones',
      consumptionsByPersonId: { ana: 1, bea: 2, carlos: 3 },
    },
    allocations: [
      { personId: 'ana', amountInCents: 1000 },
      { personId: 'bea', amountInCents: 2000 },
      { personId: 'carlos', amountInCents: 3000 },
    ],
  },
  {
    id: 'expense-individual',
    groupId: 'group-main',
    date: '2026-08-04',
    concept: 'Gasto individual',
    siteName: 'Lydo',
    totalInCents: 1200,
    participantIds: ['ana', 'bea', 'carlos'],
    distribution: {
      mode: 'importe',
      amountsByPersonId: { ana: 200, bea: 400, carlos: 600 },
    },
    allocations: [
      { personId: 'ana', amountInCents: 200 },
      { personId: 'bea', amountInCents: 400 },
      { personId: 'carlos', amountInCents: 600 },
    ],
  },
]

describe('financial adapter', () => {
  it('adapta un grupo completo sin repetir cálculos del motor', () => {
    const view = createGroupFinancialView({
      group: mainGroup,
      people,
      contributions,
      expenses,
    })

    expect(view.expenseIntegrity.every((check) => check.isConsistent)).toBe(true)
    expect(view.personIntegrity.every((check) => check.isConsistent)).toBe(true)
    expect(view.groupIntegrity.isConsistent).toBe(true)
    expect(view.personBalances).toEqual([
      { personId: 'ana', contributedInCents: 10000, spentInCents: 1534, availableInCents: 8466 },
      { personId: 'bea', contributedInCents: 10000, spentInCents: 2734, availableInCents: 7266 },
      { personId: 'carlos', contributedInCents: 10000, spentInCents: 3933, availableInCents: 6067 },
    ])
    expect(view.groupBalance).toEqual({
      groupId: 'group-main',
      contributedInCents: 30000,
      spentInCents: 8201,
      availableInCents: 21799,
    })
  })

  it('produce un saldo global igual a la suma de los grupos', () => {
    const secondaryGroup: Group = {
      id: 'group-secondary',
      name: 'Grupo secundario',
      isMainGroup: false,
      siteOptions: [],
    }
    const view = createGlobalFinancialView([
      { group: mainGroup, people, contributions, expenses },
      {
        group: secondaryGroup,
        people: [
          {
            id: 'diana',
            groupId: 'group-secondary',
            name: 'Diana',
            phone: '600000004',
            isActive: true,
          },
        ],
        contributions: [
          {
            id: 'contribution-4',
            groupId: 'group-secondary',
            personId: 'diana',
            date: '2026-08-01',
            amountInCents: 5000,
          },
        ],
        expenses: [],
      },
    ])

    expect(view.globalBalance.availableInCents).toBe(26799)
    expect(view.globalIntegrity.isConsistent).toBe(true)
    expect(view.globalBalance.availableInCents).toBe(
      view.groups.reduce((total, group) => total + group.groupBalance.availableInCents, 0),
    )
  })
})
