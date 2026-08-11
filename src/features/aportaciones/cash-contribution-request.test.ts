import { describe, expect, it } from 'vitest'
import { ContributionDomainError } from '../../domain/contributions'
import type { Contribution, Person } from '../../domain/entities'
import {
  FirestoreV4ContributionService,
  type V4ContributionLocation,
  type V4ContributionPersistencePort,
} from '../../infrastructure/firestore/firestore-v4-contribution-service'
import { CashContributionFormError, eurosToCents, eurosToNonNegativeCents } from './cash-contribution-request'
import { summarizeSameDayContributions } from './cash-contribution-confirmation'

const people: readonly Person[] = [
  { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true },
  { id: 'inactiva', groupId: 'general', name: 'Inactiva', phone: '', isActive: false },
]

class RecordingContributionPersistence implements V4ContributionPersistencePort {
  createdContribution: Contribution | null = null
  createCount = 0

  async create(_location: V4ContributionLocation, contribution: Contribution): Promise<void> {
    this.createCount += 1
    this.createdContribution = contribution
  }

  async update(
    _location: V4ContributionLocation,
    _changes: Pick<Contribution, 'amountInCents' | 'date'>,
  ): Promise<void> {}

  async delete(_location: V4ContributionLocation): Promise<void> {}
}

class FailingContributionPersistence implements V4ContributionPersistencePort {
  async create(_location: V4ContributionLocation, _contribution: Contribution): Promise<void> {
    throw new Error('Firestore no disponible')
  }

  async update(
    _location: V4ContributionLocation,
    _changes: Pick<Contribution, 'amountInCents' | 'date'>,
  ): Promise<void> {}

  async delete(_location: V4ContributionLocation): Promise<void> {}
}

describe('solicitud normal de Añadir efectivo', () => {
  it('prepara y guarda una única aportación normal mediante el servicio V4', async () => {
    const persistence = new RecordingContributionPersistence()
    const service = new FirestoreV4ContributionService(persistence)

    const contribution = await service.createCash(people, [], {
      id: 'cash-normal',
      groupId: 'general',
      personId: 'pepe',
      amountInCents: eurosToCents('10,00'),
      date: '2026-08-09',
    })

    expect(contribution).toMatchObject({ id: 'cash-normal', amountInCents: 1000, source: 'user' })
    expect(persistence.createdContribution).toEqual(contribution)
  })

  it('convierte exactamente 1,00 € a 100 céntimos', () => {
    expect(eurosToCents('1,00')).toBe(100)
  })

  it('acepta cero solamente para un importe individual de gasto', () => {
    expect(eurosToNonNegativeCents('0,00')).toBe(0)
    expect(() => eurosToCents('0,00')).toThrow(CashContributionFormError)
  })

  it.each(['0', '-1', '0,00'])('rechaza el importe no positivo %s', (amountInEuros) => {
    expect(() => eurosToCents(amountInEuros)).toThrow(CashContributionFormError)
  })

  it('mantiene la validación de fecha y persona activa del dominio', async () => {
    const service = new FirestoreV4ContributionService(new FailingContributionPersistence())

    await expect(
      service.createCash(people, [], {
        id: 'cash-1',
        groupId: 'general',
        personId: 'pepe',
        amountInCents: eurosToCents('10,00'),
        date: '2026-02-30',
      }),
    ).rejects.toBeInstanceOf(ContributionDomainError)
    await expect(
      service.createCash(people, [], {
        id: 'cash-2',
        groupId: 'general',
        personId: 'inactiva',
        amountInCents: eurosToCents('10,00'),
        date: '2026-08-09',
      }),
    ).rejects.toBeInstanceOf(ContributionDomainError)
  })

  it('propaga un error de persistencia sin convertirlo en éxito', async () => {
    const service = new FirestoreV4ContributionService(new FailingContributionPersistence())

    await expect(
      service.createCash(people, [], {
        id: 'cash-3',
        groupId: 'general',
        personId: 'pepe',
        amountInCents: eurosToCents('10,00'),
        date: '2026-08-09',
      }),
    ).rejects.toThrow('Firestore no disponible')
  })

  it('no escribe al cancelar la confirmación y crea un único movimiento al confirmarla', async () => {
    const persistence = new RecordingContributionPersistence()
    const service = new FirestoreV4ContributionService(persistence)
    const existingContributions: readonly Contribution[] = [
      {
        id: 'same-day',
        groupId: 'general',
        personId: 'pepe',
        amountInCents: 2000,
        date: '2026-08-09',
        source: 'user',
      },
    ]

    expect(summarizeSameDayContributions(existingContributions, 'pepe', '2026-08-09').count).toBe(1)
    // Cancelar la confirmación no llama al servicio.
    expect(persistence.createCount).toBe(0)

    await service.createCash(people, existingContributions, {
      id: 'cash-confirmed',
      groupId: 'general',
      personId: 'pepe',
      amountInCents: eurosToCents('10,00'),
      date: '2026-08-09',
    })

    expect(persistence.createCount).toBe(1)
  })
})
