import { describe, expect, it } from 'vitest'
import type { Contribution, Expense, Person } from '../../domain/entities'
import { editPerson, PersonDomainError } from '../../domain/persons'
import { createAdministrationPeopleList } from './people-list'

const person: Person = { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '600000000', isActive: false }

describe('edición administrativa de persona', () => {
  it('edita nombre y contacto manteniendo isActive', () => {
    expect(editPerson([person], 'general', { id: 'pepe', name: ' Pepe García ', phone: ' 611111111 ' }))
      .toEqual({ id: 'pepe', groupId: 'general', name: 'Pepe García', phone: '611111111', isActive: false })
  })

  it('rechaza un nombre vacío y aísla la edición por groupId', () => {
    expect(() => editPerson([person], 'general', { id: 'pepe', name: ' ', phone: '' }))
      .toThrow(PersonDomainError)
    expect(() => editPerson([person], 'otro', { id: 'pepe', name: 'Pepe', phone: '' }))
      .toThrow('no pertenece al grupo activo')
  })

  it('no altera aportaciones, gastos ni repartos y actualiza el listado tras recarga', () => {
    const contributions: readonly Contribution[] = [{ id: 'c-pepe', groupId: 'general', personId: 'pepe', amountInCents: 1000, date: '2026-08-10', source: 'user' }]
    const expenses: readonly Expense[] = [{
      id: 'g-pepe', groupId: 'general', date: '2026-08-10', concept: 'Cena', siteName: 'Sitio', totalInCents: 500,
      participantIds: ['pepe'], distribution: { mode: 'igual' }, allocations: [{ personId: 'pepe', amountInCents: 500 }],
    }]
    const edited = editPerson([person], 'general', { id: 'pepe', name: 'José', phone: '' })

    expect(contributions).toHaveLength(1)
    expect(expenses[0].allocations).toEqual([{ personId: 'pepe', amountInCents: 500 }])
    expect(createAdministrationPeopleList('general', [edited]))
      .toEqual([{ id: 'pepe', name: 'José', phone: '', isActive: false }])
  })
})
