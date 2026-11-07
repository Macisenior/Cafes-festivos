import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { createMonthlyIndividualStatement } from './monthly-individual-statement'

const group: Group = { id: 'general', name: 'Grupo', isMainGroup: true, siteOptions: [] }
const people: readonly Person[] = [{ id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true }]
const expense = (id: string, date: string, amountInCents: number, concept = 'Café'): Expense => ({
  id, groupId: 'general', date, concept, siteName: 'Central', totalInCents: amountInCents,
  participantIds: ['ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents }],
})

describe('extracto mensual individual', () => {
  it('reconstruye apertura, orden, disponibles tras aportaciones y cierre con el motor V4', () => {
    const contributions: readonly Contribution[] = [
      { id: 'opening', groupId: 'general', personId: 'ana', date: null, amountInCents: 400, source: 'v3-opening' },
      { id: 'before', groupId: 'general', personId: 'ana', date: '2026-09-30', amountInCents: 1000 },
      { id: 'c-1', groupId: 'general', personId: 'ana', date: '2026-10-06', amountInCents: 3000 },
      { id: 'c-2', groupId: 'general', personId: 'ana', date: '2026-10-15', amountInCents: 2500 },
      { id: 'after', groupId: 'general', personId: 'ana', date: '2026-11-01', amountInCents: 9999 },
    ]
    const expenses = [expense('e-before', '2026-09-30', 200), expense('e-1', '2026-10-02', 325), expense('e-2', '2026-10-11', 635), expense('e-after', '2026-11-01', 999)]
    const report = createMonthlyIndividualStatement(group, people, contributions, expenses, 'ana', '2026-10')

    expect(report).toMatchObject({ openingDate: '2026-09-30', from: '2026-10-01', to: '2026-10-31', openingBalanceInCents: 1200, closingBalanceInCents: 5740 })
    expect(report.movements.map((movement) => [movement.kind, movement.date, movement.amountInCents])).toEqual([
      ['expense', '2026-10-02', 325], ['contribution', '2026-10-06', 3000], ['expense', '2026-10-11', 635], ['contribution', '2026-10-15', 2500],
    ])
    expect(report.movements.filter((movement) => movement.kind === 'contribution').map((movement) => movement.availableInCents)).toEqual([3875, 5740])
  })

  it('genera meses sin movimientos conservando el saldo acumulado', () => {
    const contributions: readonly Contribution[] = [{ id: 'old', groupId: 'general', personId: 'ana', date: '2026-01-01', amountInCents: 1000 }]
    const report = createMonthlyIndividualStatement(group, people, contributions, [], 'ana', '2026-10')
    expect(report.movements).toEqual([])
    expect(report.openingBalanceInCents).toBe(1000)
    expect(report.closingBalanceInCents).toBe(1000)
  })

  it('admite saldos negativos y usa solo la asignación individual del gasto', () => {
    const shared: Expense = {
      id: 'shared', groupId: 'general', date: '2026-10-10', concept: 'Cena', siteName: 'Plaza', totalInCents: 1000,
      participantIds: ['ana', 'bea'], distribution: { mode: 'importe', amountsByPersonId: { ana: 600, bea: 400 } },
      allocations: [{ personId: 'ana', amountInCents: 600 }, { personId: 'bea', amountInCents: 400 }],
    }
    const report = createMonthlyIndividualStatement(group, people, [], [shared], 'ana', '2026-10')
    expect(report.movements[0]).toMatchObject({ kind: 'expense', amountInCents: 600 })
    expect(report.closingBalanceInCents).toBe(-600)
  })

  it('mantiene un orden determinista por identificador cuando dos movimientos comparten fecha', () => {
    const contributions: readonly Contribution[] = [{ id: 'b-contribution', groupId: 'general', personId: 'ana', date: '2026-10-10', amountInCents: 1000 }]
    const report = createMonthlyIndividualStatement(group, people, contributions, [expense('a-expense', '2026-10-10', 200)], 'ana', '2026-10')
    expect(report.movements.map((movement) => movement.id)).toEqual(['a-expense', 'b-contribution'])
    expect(report.movements[1]).toMatchObject({ kind: 'contribution', availableInCents: 800 })
  })
})
