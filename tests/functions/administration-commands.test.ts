import { describe, expect, it } from 'vitest'
import type { Group, Person } from '../../src/domain/entities'
import type { GroupFinancialEntities } from '../../src/domain/financial-adapter'
import {
  AdministrationAuthorizationError,
  executeAdministrationCommand,
  type AdministrationPort,
} from '../../functions/src/administration-commands'

const group: Group = { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [{ id: 'flap', name: 'Flap' }] }
const person: Person = { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true }

function createPort(snapshot: GroupFinancialEntities = { group, people: [person], contributions: [], expenses: [] }) {
  const calls: string[] = []
  const port: AdministrationPort = {
    listGroups: async () => [group],
    readGroup: async () => snapshot,
    createGroup: async () => { calls.push('createGroup') },
    updateGroupName: async () => { calls.push('updateGroupName') },
    deleteGroup: async () => { calls.push('deleteGroup') },
    createPerson: async (_person, contribution) => { calls.push(contribution ? 'createPersonWithContribution' : 'createPerson') },
    updatePerson: async () => { calls.push('updatePerson') },
    deletePerson: async () => { calls.push('deletePerson') },
    updateExpense: async () => { calls.push('updateExpense') },
    deleteExpense: async () => { calls.push('deleteExpense') },
    updateContribution: async () => { calls.push('updateContribution') },
    deleteContribution: async () => { calls.push('deleteContribution') },
  }
  return { port, calls }
}

describe('comandos administrativos V4 protegidos por PIN servidor', () => {
  it('rechaza un PIN administrativo incorrecto antes de cualquier escritura', async () => {
    const { port, calls } = createPort()
    await expect(executeAdministrationCommand({ pin: 'mal', action: 'deactivatePerson', groupId: 'general', payload: { personId: 'pepe' } }, 'admin-seguro', port))
      .rejects.toBeInstanceOf(AdministrationAuthorizationError)
    expect(calls).toEqual([])
  })

  it('crea persona y aportación inicial mediante una única operación de puerto', async () => {
    const { port, calls } = createPort()
    await executeAdministrationCommand({
      pin: 'admin-seguro', action: 'createPerson', groupId: 'general',
      payload: { request: { person: { id: 'ana', groupId: 'general', name: 'Ana', phone: '' }, initialContribution: { id: 'initial-ana', groupId: 'general', personId: 'ana', amountInCents: 1000, date: '2026-08-10' } } },
    }, 'admin-seguro', port)
    expect(calls).toEqual(['createPersonWithContribution'])
  })

  it('reactiva solo el documento de persona y no toca movimientos', async () => {
    const inactive = { ...person, isActive: false }
    const { port, calls } = createPort({ group, people: [inactive], contributions: [], expenses: [] })
    await executeAdministrationCommand({ pin: 'admin-seguro', action: 'reactivatePerson', groupId: 'general', payload: { personId: 'pepe' } }, 'admin-seguro', port)
    expect(calls).toEqual(['updatePerson'])
  })

  it('protege la apertura heredada frente a edición o borrado', async () => {
    const opening = { id: 'inicio', groupId: 'general', personId: 'pepe', amountInCents: 100, date: null, source: 'v3-opening' as const }
    const { port, calls } = createPort({ group, people: [person], contributions: [opening], expenses: [] })
    await expect(executeAdministrationCommand({ pin: 'admin-seguro', action: 'deleteContribution', groupId: 'general', payload: { contributionId: 'inicio' } }, 'admin-seguro', port)).rejects.toThrow()
    expect(calls).toEqual([])
  })

  it('no permite borrar el grupo principal ni elimina subcolecciones', async () => {
    const { port, calls } = createPort()
    await expect(executeAdministrationCommand({ pin: 'admin-seguro', action: 'deleteEmptyGroup', groupId: 'general', payload: { activeGroupId: 'otro' } }, 'admin-seguro', port)).rejects.toThrow()
    expect(calls).toEqual([])
  })
})

