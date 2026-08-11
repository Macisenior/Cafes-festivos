import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Person } from '../../domain/entities'
import { createOperationalHistory } from './operational-history'

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'bea', groupId: 'otro', name: 'Bea', phone: '', isActive: true },
]
const contributions: readonly Contribution[] = [
  { id: 'opening', groupId: 'general', personId: 'ana', date: null, amountInCents: 1000, source: 'v3-opening' },
  { id: 'contribution-new', groupId: 'general', personId: 'ana', date: '2026-08-09', amountInCents: 2000, source: 'user' },
  { id: 'other-contribution', groupId: 'otro', personId: 'bea', date: '2026-08-10', amountInCents: 3000 },
]
const expenses: readonly Expense[] = [
  {
    id: 'expense-new', groupId: 'general', date: '2026-08-10', concept: 'Cafés', siteName: 'Flap', totalInCents: 500,
    participantIds: ['ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 500 }],
  },
  {
    id: 'other-expense', groupId: 'otro', date: '2026-08-11', concept: 'Otro', siteName: 'Flap', totalInCents: 500,
    participantIds: ['bea'], distribution: { mode: 'igual' }, allocations: [{ personId: 'bea', amountInCents: 500 }],
  },
]

describe('historial operativo', () => {
  it('aísla los movimientos del grupo activo y los ordena de más reciente a más antiguo', () => {
    const history = createOperationalHistory('general', people, contributions, expenses)

    expect(history.map((entry) => entry.id)).toEqual(['expense-new', 'contribution-new', 'opening'])
  })

  it('conserva la apertura heredada sin inventarle una fecha', () => {
    const opening = createOperationalHistory('general', people, contributions, expenses).at(-1)

    expect(opening).toMatchObject({ kind: 'contribution', date: null, isInheritedOpening: true, amountInCents: 1000 })
  })

  it('incluye los datos de consulta necesarios de gastos y aportaciones', () => {
    const history = createOperationalHistory('general', people, contributions, expenses)

    expect(history[0]).toMatchObject({ kind: 'expense', concept: 'Cafés', participantsCount: 1, distributionMode: 'igual' })
    expect(history[1]).toMatchObject({ kind: 'contribution', personName: 'Ana', amountInCents: 2000 })
  })

  it('conserva en el histórico los movimientos de personas actualmente inactivas', () => {
    const inactivePeople = people.map((person) => person.id === 'ana' ? { ...person, isActive: false } : person)

    const history = createOperationalHistory('general', inactivePeople, contributions, expenses)

    expect(history.find((entry) => entry.id === 'contribution-new')).toMatchObject({
      kind: 'contribution',
      personName: 'Ana',
      amountInCents: 2000,
    })
  })

  it('devuelve un histórico vacío cuando el grupo activo no tiene movimientos', () => {
    expect(createOperationalHistory('vacío', people, contributions, expenses)).toEqual([])
  })
})
