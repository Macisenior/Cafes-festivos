import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { toggleProSummaryDetail } from './pro-summary-details'
import { createProSummary } from './pro-summary'

const group: Group = { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] }
const people: readonly Person[] = [
  { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: false },
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'other', groupId: 'otro', name: 'Other', phone: '', isActive: true },
]
const contributions: readonly Contribution[] = [
  { id: 'opening', groupId: 'general', personId: 'pepe', date: null, amountInCents: 50000, source: 'v3-opening' },
  { id: 'pepe-a', groupId: 'general', personId: 'pepe', date: '2026-08-02', amountInCents: 10000 },
  { id: 'pepe-b', groupId: 'general', personId: 'pepe', date: '2026-08-01', amountInCents: 2000 },
  { id: 'ana', groupId: 'general', personId: 'ana', date: '2026-08-01', amountInCents: 10000 },
  { id: 'other', groupId: 'otro', personId: 'other', date: '2026-08-01', amountInCents: 99999 },
]
const expenses: readonly Expense[] = [
  { id: 'expense', groupId: 'general', date: '2026-08-03', siteName: 'Flap', concept: 'Cafés', totalInCents: 5000, participantIds: ['pepe', 'ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'pepe', amountInCents: 2500 }, { personId: 'ana', amountInCents: 2500 }] },
  { id: 'other', groupId: 'otro', date: '2026-08-03', siteName: 'Otro', concept: 'Otro', totalInCents: 999, participantIds: ['other'], distribution: { mode: 'igual' }, allocations: [{ personId: 'other', amountInCents: 999 }] },
]

describe('Resumen PRO', () => {
  it('muestra apertura heredada, aportaciones fechadas ordenadas y saldo derivado por persona', () => {
    const summary = createProSummary(group, people, contributions, expenses)

    expect(summary[0]).toMatchObject({
      personId: 'pepe', isActive: false, totalContributedInCents: 62000, totalSpentInCents: 2500, balanceInCents: 59500,
      openingContributions: [expect.objectContaining({ id: 'opening', date: null, amountInCents: 50000 })],
    })
    expect(summary[0].datedContributions.map((contribution) => contribution.id)).toEqual(['pepe-a', 'pepe-b'])
    expect(summary[1]).toMatchObject({ personId: 'ana', openingContributions: [], totalContributedInCents: 10000, totalSpentInCents: 2500, balanceInCents: 7500 })
  })

  it('aísla el grupo activo y no incorpora movimientos de otros grupos', () => {
    expect(createProSummary(group, people, contributions, expenses).map((person) => person.personId)).toEqual(['pepe', 'ana'])
  })

  it('despliega y pliega una persona sin alterar el informe preparado', () => {
    const summary = createProSummary(group, people, contributions, expenses)
    const expanded = toggleProSummaryDetail([], 'pepe')

    expect(expanded).toEqual(['pepe'])
    expect(toggleProSummaryDetail(expanded, 'pepe')).toEqual([])
    expect(summary[0].totalContributedInCents).toBe(62000)
  })
})
