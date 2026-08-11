import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Person } from '../../domain/entities'
import { deactivatePerson } from '../../domain/persons'
import { createAdministrationPeopleList } from './people-list'
import { canDeactivatePerson } from './person-deactivation'

const activePerson: Person = { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true }
const inactivePerson: Person = { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: false }

describe('inactivación administrativa de personas', () => {
  it('permite inactivar una persona activa y la conserva en el listado como inactiva tras la recarga', () => {
    const deactivated = deactivatePerson([activePerson], 'general', 'pepe')

    expect(deactivated.isActive).toBe(false)
    expect(createAdministrationPeopleList('general', [deactivated]))
      .toEqual([{ id: 'pepe', name: 'Pepe', phone: '', isActive: false }])
  })

  it('no ofrece la baja para una persona ya inactiva ni para otra perteneciente a otro grupo', () => {
    expect(canDeactivatePerson('general', inactivePerson)).toBe(false)
    expect(canDeactivatePerson('otro', activePerson)).toBe(false)
    expect(canDeactivatePerson('general', activePerson)).toBe(true)
  })

  it('no modifica aportaciones, gastos ni repartos al preparar la inactivación', () => {
    const contributions: readonly Contribution[] = [{ id: 'c-pepe', groupId: 'general', personId: 'pepe', amountInCents: 1000, date: '2026-08-10', source: 'user' }]
    const expenses: readonly Expense[] = [{
      id: 'g-pepe', groupId: 'general', date: '2026-08-10', concept: 'Cena', siteName: 'Sitio', totalInCents: 500,
      participantIds: ['pepe'], distribution: { mode: 'igual' }, allocations: [{ personId: 'pepe', amountInCents: 500 }],
    }]

    deactivatePerson([activePerson], 'general', 'pepe')

    expect(contributions).toHaveLength(1)
    expect(expenses[0].allocations).toEqual([{ personId: 'pepe', amountInCents: 500 }])
  })
})
