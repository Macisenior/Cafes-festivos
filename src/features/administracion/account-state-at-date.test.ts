import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { createAccountStateAtDateReport } from './account-state-at-date'

const group: Group = { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] }
const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: false },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
  { id: 'other', groupId: 'otro', name: 'Other', phone: '', isActive: true },
]
const contributions: readonly Contribution[] = [
  { id: 'opening', groupId: 'general', personId: 'ana', date: null, amountInCents: 1000, source: 'v3-opening' },
  { id: 'ana-early', groupId: 'general', personId: 'ana', date: '2026-08-01', amountInCents: 2000 },
  { id: 'bea-limit', groupId: 'general', personId: 'bea', date: '2026-08-10', amountInCents: 1000 },
  { id: 'later', groupId: 'general', personId: 'ana', date: '2026-08-11', amountInCents: 500 },
  { id: 'other', groupId: 'otro', personId: 'other', date: '2026-08-01', amountInCents: 9999 },
]
const expenses: readonly Expense[] = [
  { id: 'early', groupId: 'general', date: '2026-08-01', siteName: 'Flap', concept: 'Temprano', totalInCents: 900, participantIds: ['ana', 'bea'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 450 }, { personId: 'bea', amountInCents: 450 }] },
  { id: 'limit', groupId: 'general', date: '2026-08-10', siteName: 'Lydo', concept: 'Límite', totalInCents: 300, participantIds: ['ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 300 }] },
  { id: 'later', groupId: 'general', date: '2026-08-11', siteName: 'Flap', concept: 'Posterior', totalInCents: 200, participantIds: ['bea'], distribution: { mode: 'igual' }, allocations: [{ personId: 'bea', amountInCents: 200 }] },
  { id: 'other', groupId: 'otro', date: '2026-08-01', siteName: 'Otro', concept: 'Otro', totalInCents: 999, participantIds: ['other'], distribution: { mode: 'igual' }, allocations: [{ personId: 'other', amountInCents: 999 }] },
]

describe('Estado a una fecha', () => {
  it('calcula aportado menos gasto asignado hasta el final de la fecha, en céntimos', () => {
    const report = createAccountStateAtDateReport(group, people, contributions, expenses, '2026-08-10')

    expect(report.people).toEqual([
      expect.objectContaining({ personId: 'ana', isActive: false, contributedInCents: 3000, spentInCents: 750, balanceInCents: 2250 }),
      expect.objectContaining({ personId: 'bea', contributedInCents: 1000, spentInCents: 450, balanceInCents: 550 }),
    ])
    expect(report).toMatchObject({ groupContributedInCents: 4000, groupSpentInCents: 1200, groupBalanceInCents: 2800 })
  })

  it('incluye los límites del día y excluye movimientos posteriores', () => {
    const onLimit = createAccountStateAtDateReport(group, people, contributions, expenses, '2026-08-10')
    const beforeLimit = createAccountStateAtDateReport(group, people, contributions, expenses, '2026-08-09')

    expect(onLimit.groupBalanceInCents).toBe(2800)
    expect(beforeLimit.groupBalanceInCents).toBe(2100)
  })

  it('incluye aperturas heredadas sin fecha como saldo inicial y excluye otros grupos', () => {
    const report = createAccountStateAtDateReport(group, people, contributions, expenses, '2026-08-10')

    expect(report.groupContributedInCents).toBe(4000)
    expect(report.people.find((person) => person.personId === 'ana')).toMatchObject({ contributedInCents: 3000, balanceInCents: 2250 })
    expect(report.people.map((person) => person.personId)).not.toContain('other')
  })
})
