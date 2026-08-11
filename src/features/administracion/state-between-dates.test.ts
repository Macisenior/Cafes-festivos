import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { createStateBetweenDatesReport } from './state-between-dates'

const group: Group = { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] }
const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: false },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
  { id: 'other', groupId: 'other', name: 'Other', phone: '', isActive: true },
]
const contributions: readonly Contribution[] = [
  { id: 'opening', groupId: 'general', personId: 'ana', date: null, amountInCents: 1000, source: 'v3-opening' },
  { id: 'before', groupId: 'general', personId: 'ana', date: '2026-08-01', amountInCents: 2000 },
  { id: 'inside', groupId: 'general', personId: 'bea', date: '2026-08-05', amountInCents: 1500 },
  { id: 'limit', groupId: 'general', personId: 'ana', date: '2026-08-10', amountInCents: 500 },
  { id: 'after', groupId: 'general', personId: 'bea', date: '2026-08-11', amountInCents: 900 },
  { id: 'other', groupId: 'other', personId: 'other', date: '2026-08-05', amountInCents: 9999 },
]
const expenses: readonly Expense[] = [
  { id: 'before', groupId: 'general', date: '2026-08-01', siteName: 'Flap', concept: 'Antes', totalInCents: 300, participantIds: ['ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 300 }] },
  { id: 'inside', groupId: 'general', date: '2026-08-05', siteName: 'Lydo', concept: 'Dentro', totalInCents: 400, participantIds: ['ana', 'bea'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 200 }, { personId: 'bea', amountInCents: 200 }] },
  { id: 'limit', groupId: 'general', date: '2026-08-10', siteName: 'Lydo', concept: 'Límite', totalInCents: 100, participantIds: ['ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 100 }] },
  { id: 'after', groupId: 'general', date: '2026-08-11', siteName: 'Flap', concept: 'Después', totalInCents: 200, participantIds: ['bea'], distribution: { mode: 'igual' }, allocations: [{ personId: 'bea', amountInCents: 200 }] },
  { id: 'other', groupId: 'other', date: '2026-08-05', siteName: 'Other', concept: 'Otro', totalInCents: 999, participantIds: ['other'], distribution: { mode: 'igual' }, allocations: [{ personId: 'other', amountInCents: 999 }] },
]

describe('Estado entre fechas', () => {
  it('incluye ambos límites y muestra la evolución acumulada exclusivamente del grupo activo', () => {
    const report = createStateBetweenDatesReport(group, people, contributions, expenses, '2026-08-05', '2026-08-10')

    expect(report.openingBalanceInCents).toBe(2700)
    expect(report.snapshots.map((snapshot) => snapshot.date)).toEqual(['2026-08-05', '2026-08-10'])
    expect(report.snapshots.map((snapshot) => snapshot.groupBalanceInCents)).toEqual([3800, 4200])
    expect(report.closingBalanceInCents).toBe(4200)
  })

  it('incluye Inicio como saldo de apertura sin inventarle fecha y conserva a la persona inactiva', () => {
    const report = createStateBetweenDatesReport(group, people, contributions, expenses, '2026-08-05', '2026-08-10')

    expect(report.openingDate).toBe('2026-08-04')
    expect(report.opening.people.find((person) => person.personId === 'ana')).toMatchObject({ isActive: false, contributedInCents: 3000, balanceInCents: 2700 })
    expect(report.snapshots[0].people.map((person) => person.personId)).toEqual(['ana', 'bea'])
  })

  it('excluye movimientos posteriores al rango y rechaza rangos invertidos', () => {
    const report = createStateBetweenDatesReport(group, people, contributions, expenses, '2026-08-05', '2026-08-10')

    expect(report.closing.groupContributedInCents).toBe(5000)
    expect(report.closing.groupSpentInCents).toBe(800)
    expect(() => createStateBetweenDatesReport(group, people, contributions, expenses, '2026-08-10', '2026-08-05')).toThrow('Desde')
  })
})
