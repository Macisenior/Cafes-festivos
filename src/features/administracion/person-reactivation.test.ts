import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Person } from '../../domain/entities'
import { reactivatePerson } from '../../domain/persons'
import { createAdministrationPeopleList } from './people-list'
import { canReactivatePerson } from './person-deactivation'

const inactivePerson: Person = { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: false }
const activePerson: Person = { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true }

describe('reactivación administrativa de personas', () => {
  it('reactiva una persona inactiva y la muestra activa tras la recarga del listado', () => {
    const reactivated = reactivatePerson([inactivePerson], 'general', 'pepe')

    expect(reactivated.isActive).toBe(true)
    expect(createAdministrationPeopleList('general', [reactivated]))
      .toEqual([{ id: 'pepe', name: 'Pepe', phone: '', isActive: true }])
  })

  it('solo ofrece reactivación a personas inactivas del grupo activo', () => {
    expect(canReactivatePerson('general', inactivePerson)).toBe(true)
    expect(canReactivatePerson('general', activePerson)).toBe(false)
    expect(canReactivatePerson('otro', inactivePerson)).toBe(false)
  })

  it('mantiene aportaciones, gastos y repartos históricos sin modificaciones', () => {
    const contributions: readonly Contribution[] = [{ id: 'c-pepe', groupId: 'general', personId: 'pepe', amountInCents: 1000, date: '2026-08-10', source: 'user' }]
    const expenses: readonly Expense[] = [{
      id: 'g-pepe', groupId: 'general', date: '2026-08-10', concept: 'Cena', siteName: 'Sitio', totalInCents: 500,
      participantIds: ['pepe'], distribution: { mode: 'igual' }, allocations: [{ personId: 'pepe', amountInCents: 500 }],
    }]

    reactivatePerson([inactivePerson], 'general', 'pepe')

    expect(contributions).toHaveLength(1)
    expect(expenses[0].allocations).toEqual([{ personId: 'pepe', amountInCents: 500 }])
  })
})
