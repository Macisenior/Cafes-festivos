import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Person } from './entities'
import { canPhysicallyDeletePerson, deletePerson, PersonDomainError } from './persons'
import { createAdministrationPeopleList } from '../features/administracion/people-list'

const activePerson: Person = { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true }
const inactivePerson: Person = { ...activePerson, isActive: false }

function expenseForPepe(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'gasto-pepe', groupId: 'general', date: '2026-08-10', concept: 'Cena', siteName: 'Sitio', totalInCents: 500,
    participantIds: ['pepe'], distribution: { mode: 'igual' }, allocations: [{ personId: 'pepe', amountInCents: 500 }],
    ...overrides,
  }
}

describe('borrado físico controlado de personas', () => {
  it('permite borrar una persona activa sin historial y la elimina del listado tras recarga', () => {
    expect(canPhysicallyDeletePerson([activePerson], [], [], 'general', 'pepe')).toBe(true)
    const remaining = deletePerson([activePerson], [], [], 'general', 'pepe')

    expect(remaining).toEqual([])
    expect(createAdministrationPeopleList('general', remaining)).toEqual([])
  })

  it('permite borrar una persona inactiva sin historial', () => {
    expect(canPhysicallyDeletePerson([inactivePerson], [], [], 'general', 'pepe')).toBe(true)
    expect(deletePerson([inactivePerson], [], [], 'general', 'pepe')).toEqual([])
  })

  it('rechaza aportaciones normales y aperturas heredadas como historial', () => {
    const contribution: Contribution = { id: 'c-pepe', groupId: 'general', personId: 'pepe', amountInCents: 1000, date: '2026-08-10', source: 'user' }
    const inheritedOpening: Contribution = { id: 'opening-pepe', groupId: 'general', personId: 'pepe', amountInCents: 500, date: null, source: 'v3-opening' }

    expect(canPhysicallyDeletePerson([activePerson], [contribution], [], 'general', 'pepe')).toBe(false)
    expect(canPhysicallyDeletePerson([activePerson], [inheritedOpening], [], 'general', 'pepe')).toBe(false)
    expect(() => deletePerson([activePerson], [inheritedOpening], [], 'general', 'pepe')).toThrow(PersonDomainError)
  })

  it('rechaza la participación o una asignación final de un gasto como historial', () => {
    const allocationOnly = expenseForPepe({ participantIds: [] })

    expect(canPhysicallyDeletePerson([activePerson], [], [expenseForPepe()], 'general', 'pepe')).toBe(false)
    expect(canPhysicallyDeletePerson([activePerson], [], [allocationOnly], 'general', 'pepe')).toBe(false)
  })

  it('rechaza una persona inactiva que conserva historial y no modifica movimientos', () => {
    const contributions: readonly Contribution[] = [{ id: 'c-pepe', groupId: 'general', personId: 'pepe', amountInCents: 1000, date: '2026-08-10', source: 'user' }]
    const expenses: readonly Expense[] = [expenseForPepe()]

    expect(() => deletePerson([inactivePerson], contributions, expenses, 'general', 'pepe')).toThrow('historial financiero')
    expect(contributions).toHaveLength(1)
    expect(expenses[0].allocations).toEqual([{ personId: 'pepe', amountInCents: 500 }])
  })

  it('aísla la comprobación por groupId y conserva las otras personas', () => {
    const otherPerson: Person = { id: 'pepe', groupId: 'otro', name: 'Pepe otro', phone: '', isActive: true }
    const otherContribution: Contribution = { id: 'c-otro', groupId: 'otro', personId: 'pepe', amountInCents: 1000, date: '2026-08-10', source: 'user' }

    expect(canPhysicallyDeletePerson([activePerson, otherPerson], [otherContribution], [], 'general', 'pepe')).toBe(true)
    expect(deletePerson([activePerson, otherPerson], [otherContribution], [], 'general', 'pepe')).toEqual([otherPerson])
  })
})
