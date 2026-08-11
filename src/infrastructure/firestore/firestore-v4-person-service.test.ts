import { describe, expect, it } from 'vitest'
import type { Contribution, Person } from '../../domain/entities'
import {
  FirestoreV4PersonPathError,
  FirestoreV4PersonService,
  type V4PersonInitialContributionLocation,
  type V4PersonLocation,
  type V4PersonPersistencePort,
} from './firestore-v4-person-service'

class RecordingPersonPersistence implements V4PersonPersistencePort {
  readonly operations: Array<
    | { type: 'create'; location: V4PersonLocation; person: Person }
    | {
        type: 'createWithInitialContribution'
        personLocation: V4PersonLocation
        contributionLocation: V4PersonInitialContributionLocation
        person: Person
        contribution: Contribution
      }
    | { type: 'deactivate'; location: V4PersonLocation }
    | { type: 'reactivate'; location: V4PersonLocation }
    | { type: 'edit'; location: V4PersonLocation; changes: Pick<Person, 'name' | 'phone'> }
    | { type: 'delete'; location: V4PersonLocation }
  > = []

  async create(location: V4PersonLocation, person: Person): Promise<void> {
    this.operations.push({ type: 'create', location, person })
  }

  async createWithInitialContribution(
    personLocation: V4PersonLocation,
    contributionLocation: V4PersonInitialContributionLocation,
    person: Person,
    contribution: Contribution,
  ): Promise<void> {
    this.operations.push({ type: 'createWithInitialContribution', personLocation, contributionLocation, person, contribution })
  }

  async deactivate(location: V4PersonLocation): Promise<void> {
    this.operations.push({ type: 'deactivate', location })
  }

  async reactivate(location: V4PersonLocation): Promise<void> {
    this.operations.push({ type: 'reactivate', location })
  }

  async edit(location: V4PersonLocation, changes: Pick<Person, 'name' | 'phone'>): Promise<void> {
    this.operations.push({ type: 'edit', location, changes })
  }

  async delete(location: V4PersonLocation): Promise<void> {
    this.operations.push({ type: 'delete', location })
  }
}

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
]

describe('FirestoreV4PersonService', () => {
  it('crea una persona sin aportación inicial exclusivamente bajo grupos_v4/{grupo}/personas/{persona}', async () => {
    const persistence = new RecordingPersonPersistence()
    const service = new FirestoreV4PersonService(persistence)

    await service.create(people, [], {
      person: { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '' },
    })

    expect(persistence.operations).toEqual([{
      type: 'create',
      location: { rootCollection: 'grupos_v4', groupId: 'general', personId: 'pepe' },
      person: { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true },
    }])
  })

  it('crea persona y aportación inicial en una única operación de persistencia atómica V4', async () => {
    const persistence = new RecordingPersonPersistence()
    const service = new FirestoreV4PersonService(persistence)

    await service.create(people, [], {
      person: { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '' },
      initialContribution: {
        id: 'opening-pepe', groupId: 'general', personId: 'pepe', amountInCents: 2000, date: '2026-08-10',
      },
    })

    expect(persistence.operations).toEqual([{
      type: 'createWithInitialContribution',
      personLocation: { rootCollection: 'grupos_v4', groupId: 'general', personId: 'pepe' },
      contributionLocation: { rootCollection: 'grupos_v4', groupId: 'general', contributionId: 'opening-pepe' },
      person: { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true },
      contribution: {
        id: 'opening-pepe', groupId: 'general', personId: 'pepe', amountInCents: 2000, date: '2026-08-10', source: 'user',
      },
    }])
  })

  it('da de baja sin tocar aportaciones ni gastos existentes', async () => {
    const persistence = new RecordingPersonPersistence()
    const service = new FirestoreV4PersonService(persistence)
    const contributions: readonly Contribution[] = [{ id: 'c-ana', groupId: 'general', personId: 'ana', amountInCents: 1000, date: '2026-08-10', source: 'user' }]

    const person = await service.deactivate(people, 'general', 'ana')

    expect(person).toMatchObject({ id: 'ana', isActive: false })
    expect(contributions).toHaveLength(1)
    expect(persistence.operations).toEqual([{
      type: 'deactivate',
      location: { rootCollection: 'grupos_v4', groupId: 'general', personId: 'ana' },
    }])
  })

  it('reactiva únicamente la persona inactiva bajo la ruta V4 de su grupo', async () => {
    const persistence = new RecordingPersonPersistence()
    const service = new FirestoreV4PersonService(persistence)
    const inactivePeople: readonly Person[] = [{ ...people[0], isActive: false }]

    const person = await service.reactivate(inactivePeople, 'general', 'ana')

    expect(person).toMatchObject({ id: 'ana', isActive: true })
    expect(persistence.operations).toEqual([{
      type: 'reactivate',
      location: { rootCollection: 'grupos_v4', groupId: 'general', personId: 'ana' },
    }])
  })

  it('edita únicamente nombre y contacto en el documento V4 de la persona seleccionada', async () => {
    const persistence = new RecordingPersonPersistence()
    const service = new FirestoreV4PersonService(persistence)

    const person = await service.edit(people, 'general', { id: 'ana', name: 'Ana María', phone: '611111111' })

    expect(person).toMatchObject({ id: 'ana', name: 'Ana María', phone: '611111111', isActive: true })
    expect(persistence.operations).toEqual([{
      type: 'edit',
      location: { rootCollection: 'grupos_v4', groupId: 'general', personId: 'ana' },
      changes: { name: 'Ana María', phone: '611111111' },
    }])
  })

  it('elimina exclusivamente el documento V4 de una persona sin historial', async () => {
    const persistence = new RecordingPersonPersistence()
    const service = new FirestoreV4PersonService(persistence)

    const remaining = await service.delete(people, [], [], 'general', 'ana')

    expect(remaining).toEqual([])
    expect(persistence.operations).toEqual([{
      type: 'delete',
      location: { rootCollection: 'grupos_v4', groupId: 'general', personId: 'ana' },
    }])
  })

  it('rechaza rutas V3 o malformadas antes de persistir', async () => {
    const persistence = new RecordingPersonPersistence()
    const service = new FirestoreV4PersonService(persistence)

    await expect(service.create(people, [], {
      person: { id: 'pepe', groupId: 'grupos/general', name: 'Pepe', phone: '' },
    })).rejects.toBeInstanceOf(FirestoreV4PersonPathError)
    await expect(service.deactivate(people, 'general', 'grupos/ana')).rejects.toBeInstanceOf(FirestoreV4PersonPathError)
    expect(persistence.operations).toEqual([])
  })
})
