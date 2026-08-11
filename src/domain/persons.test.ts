import { describe, expect, it } from 'vitest'
import { addCashContribution } from './contributions'
import type { Contribution, Expense, Person } from './entities'
import {
  createPersonWithOptionalInitialContribution,
  deactivatePerson,
} from './persons'
import { getActivePeople } from '../features/identificacion/local-user'
import { createOperationalHistory } from '../features/operativa/operational-history'

const existingPeople: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '600000000', isActive: true },
]

const initialContribution = {
  id: 'initial-pepe',
  groupId: 'general',
  personId: 'pepe',
  amountInCents: 2000,
  date: '2026-08-10',
} as const

describe('dominio de personas V4', () => {
  it('da de alta una persona activa sin acumulados financieros', () => {
    const result = createPersonWithOptionalInitialContribution(existingPeople, [], {
      person: { id: 'pepe', groupId: 'general', name: ' Pepe ', phone: ' 611111111 ' },
    })

    expect(result).toEqual({
      person: { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '611111111', isActive: true },
    })
    expect(result.person).not.toHaveProperty('aportado')
  })

  it('crea la aportación inicial usando exactamente la misma lógica que Añadir efectivo', () => {
    const result = createPersonWithOptionalInitialContribution(existingPeople, [], {
      person: { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '' },
      initialContribution,
    })
    const cashContribution = addCashContribution([...existingPeople, result.person], [], initialContribution)

    expect(result.initialContribution).toEqual(cashContribution)
  })

  it('rechaza una aportación inicial que no pertenezca a la persona o grupo del alta', () => {
    expect(() => createPersonWithOptionalInitialContribution(existingPeople, [], {
      person: { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '' },
      initialContribution: { ...initialContribution, personId: 'ana' },
    })).toThrow('La aportación inicial debe pertenecer')
  })

  it('da de baja sin modificar aportaciones, gastos ni el historial visible', () => {
    const person = { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true }
    const people = [...existingPeople, person]
    const contributions: readonly Contribution[] = [{ ...initialContribution, source: 'user' }]
    const expenses: readonly Expense[] = [{
      id: 'gasto-pepe', groupId: 'general', date: '2026-08-10', concept: 'Cena', siteName: 'Sitio', totalInCents: 500,
      participantIds: ['pepe'], distribution: { mode: 'igual' }, allocations: [{ personId: 'pepe', amountInCents: 500 }],
    }]
    const inactivePerson = deactivatePerson(people, 'general', 'pepe')
    const updatedPeople = people.map((candidate) => candidate.id === inactivePerson.id ? inactivePerson : candidate)

    expect(inactivePerson.isActive).toBe(false)
    expect(contributions).toEqual([{ ...initialContribution, source: 'user' }])
    expect(expenses[0].participantIds).toEqual(['pepe'])
    expect(getActivePeople(updatedPeople, 'general').map((candidate) => candidate.id)).toEqual(['ana'])
    expect(createOperationalHistory('general', updatedPeople, contributions, expenses).map((entry) => entry.id))
      .toEqual(['initial-pepe', 'gasto-pepe'])
  })

  it('aísla las personas por groupId incluso cuando reutilizan identificador', () => {
    const sameIdInOtherGroup: Person = { id: 'ana', groupId: 'otro', name: 'Ana otro grupo', phone: '', isActive: true }

    expect(deactivatePerson([...existingPeople, sameIdInOtherGroup], 'otro', 'ana'))
      .toMatchObject({ groupId: 'otro', isActive: false })
    expect(() => deactivatePerson(existingPeople, 'otro', 'ana')).toThrow('no pertenece al grupo activo')
  })
})
