import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Person } from '../../domain/entities'
import type { PersonBalance } from '../../domain/balances'
import { createPersonAccountSummary } from './person-account-summary'

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: false },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
]
const balance: PersonBalance = { personId: 'ana', contributedInCents: 3000, spentInCents: 700, availableInCents: 2300 }
const contributions: readonly Contribution[] = [
  { id: 'opening', groupId: 'general', personId: 'ana', date: null, amountInCents: 1000, source: 'v3-opening' },
  { id: 'cash', groupId: 'general', personId: 'ana', date: '2026-08-09', amountInCents: 2000 },
]
const expenses: readonly Expense[] = [
  { id: 'shared', groupId: 'general', date: '2026-08-10', siteName: 'Flap', concept: 'Cafés', totalInCents: 1000, participantIds: ['ana', 'bea'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 700 }, { personId: 'bea', amountInCents: 300 }] },
]

describe('resumen desplegable de una persona', () => {
  it('reutiliza el balance V4 y muestra en gastos solo la asignación real de la persona', () => {
    const summary = createPersonAccountSummary('general', 'ana', balance, people, contributions, expenses)

    expect(summary).toMatchObject({ contributedInCents: 3000, spentInCents: 700, balanceInCents: 2300 })
    expect(summary.recentMovements).toEqual([
      expect.objectContaining({ kind: 'expense', id: 'shared', amountInCents: 700 }),
      expect.objectContaining({ kind: 'contribution', id: 'cash', amountInCents: 2000 }),
      expect.objectContaining({ kind: 'contribution', id: 'opening', date: null, title: 'Inicio' }),
    ])
  })

  it('mantiene las aportaciones heredadas sin fecha y limita el detalle a los últimos movimientos', () => {
    expect(createPersonAccountSummary('general', 'ana', balance, people, contributions, expenses, 2).recentMovements.map((movement) => movement.id)).toEqual(['shared', 'cash'])
    expect(createPersonAccountSummary('general', 'bea', { personId: 'bea', contributedInCents: 0, spentInCents: 300, availableInCents: -300 }, people, contributions, expenses).recentMovements).toEqual([expect.objectContaining({ id: 'shared', amountInCents: 300 })])
  })
})
