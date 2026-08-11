import { describe, expect, it } from 'vitest'
import type { Contribution, Person } from '../../domain/entities'
import {
  FirestoreV4ContributionPathError,
  FirestoreV4ContributionService,
  type V4ContributionLocation,
  type V4ContributionPersistencePort,
} from './firestore-v4-contribution-service'

class RecordingContributionPersistence implements V4ContributionPersistencePort {
  readonly operations: Array<
    | { type: 'create'; location: V4ContributionLocation; contribution: Contribution }
    | {
        type: 'update'
        location: V4ContributionLocation
        changes: Pick<Contribution, 'amountInCents' | 'date'>
      }
    | { type: 'delete'; location: V4ContributionLocation }
  > = []

  async create(location: V4ContributionLocation, contribution: Contribution): Promise<void> {
    this.operations.push({ type: 'create', location, contribution })
  }

  async update(
    location: V4ContributionLocation,
    changes: Pick<Contribution, 'amountInCents' | 'date'>,
  ): Promise<void> {
    this.operations.push({ type: 'update', location, changes })
  }

  async delete(location: V4ContributionLocation): Promise<void> {
    this.operations.push({ type: 'delete', location })
  }
}

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
]

const input = {
  id: 'contribution-1',
  groupId: 'general',
  personId: 'ana',
  amountInCents: 2000,
  date: '2026-08-09',
} as const

describe('FirestoreV4ContributionService', () => {
  it('crea un documento independiente exclusivamente bajo grupos_v4/{grupo}/aportaciones/{id}', async () => {
    const persistence = new RecordingContributionPersistence()
    const service = new FirestoreV4ContributionService(persistence)

    await service.createCash(people, [], input)

    expect(persistence.operations).toEqual([
      {
        type: 'create',
        location: {
          rootCollection: 'grupos_v4',
          groupId: 'general',
          contributionId: 'contribution-1',
        },
        contribution: { ...input, source: 'user' },
      },
    ])
  })

  it('edita únicamente importe y fecha de la aportación indicada', async () => {
    const persistence = new RecordingContributionPersistence()
    const service = new FirestoreV4ContributionService(persistence)
    const contribution = await service.create(people, [], input)
    persistence.operations.length = 0

    const result = await service.edit([contribution], {
      id: contribution.id,
      amountInCents: 2500,
      date: '2026-08-10',
    })

    expect(result).toEqual([{ ...contribution, amountInCents: 2500, date: '2026-08-10' }])
    expect(persistence.operations).toEqual([
      {
        type: 'update',
        location: {
          rootCollection: 'grupos_v4',
          groupId: 'general',
          contributionId: 'contribution-1',
        },
        changes: { amountInCents: 2500, date: '2026-08-10' },
      },
    ])
  })

  it('elimina únicamente el documento de aportación indicado', async () => {
    const persistence = new RecordingContributionPersistence()
    const service = new FirestoreV4ContributionService(persistence)
    const contribution = await service.create(people, [], input)
    persistence.operations.length = 0

    await service.delete([contribution], contribution.id)

    expect(persistence.operations).toEqual([
      {
        type: 'delete',
        location: {
          rootCollection: 'grupos_v4',
          groupId: 'general',
          contributionId: 'contribution-1',
        },
      },
    ])
  })

  it('rechaza identificadores que intentan introducir una ruta V3', async () => {
    const persistence = new RecordingContributionPersistence()
    const service = new FirestoreV4ContributionService(persistence)

    await expect(
      service.create(people, [], { ...input, groupId: 'grupos/general' }),
    ).rejects.toBeInstanceOf(FirestoreV4ContributionPathError)
    expect(persistence.operations).toEqual([])
  })
})
