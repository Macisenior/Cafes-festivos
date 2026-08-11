import { describe, expect, it } from 'vitest'
import type { Contribution, Person } from './entities'
import { calculateTotalContributedByPerson } from './financial-engine'
import {
  ContributionDomainError,
  addCashContribution,
  createInitialContribution,
  deleteContribution,
  editContribution,
} from './contributions'

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
  { id: 'carmen', groupId: 'general', name: 'Carmen', phone: '', isActive: false },
]

const contributionInput = {
  id: 'contribution-1',
  groupId: 'general',
  personId: 'ana',
  amountInCents: 2000,
  date: '2026-08-09',
} as const

describe('operaciones de aportación V4', () => {
  it('crea una aportación de 20 € como un movimiento de 2.000 céntimos', () => {
    const contribution = addCashContribution(people, [], contributionInput)
    expect(contribution).toEqual({ ...contributionInput, source: 'user' })
  })

  it('acumula dos aportaciones de una persona mediante el motor financiero', () => {
    const firstContribution = addCashContribution(people, [], contributionInput)
    const secondContribution = addCashContribution(people, [firstContribution], {
      ...contributionInput,
      id: 'contribution-2',
      amountInCents: 500,
    })

    expect(calculateTotalContributedByPerson('ana', [firstContribution, secondContribution])).toBe(2500)
  })

  it('edita únicamente el movimiento indicado', () => {
    const firstContribution = addCashContribution(people, [], contributionInput)
    const secondContribution = addCashContribution(people, [firstContribution], {
      ...contributionInput,
      id: 'contribution-2',
      personId: 'bea',
    })

    expect(
      editContribution([firstContribution, secondContribution], {
        id: 'contribution-1',
        amountInCents: 3500,
        date: '2026-08-10',
      }),
    ).toEqual([
      { ...firstContribution, amountInCents: 3500, date: '2026-08-10' },
      secondContribution,
    ])
  })

  it('elimina únicamente el movimiento indicado', () => {
    const firstContribution = addCashContribution(people, [], contributionInput)
    const secondContribution = addCashContribution(people, [firstContribution], {
      ...contributionInput,
      id: 'contribution-2',
    })

    expect(deleteContribution([firstContribution, secondContribution], 'contribution-1')).toEqual([
      secondContribution,
    ])
  })

  it('no modifica ni crea acumulados financieros en la persona', () => {
    const originalPerson = people[0]
    addCashContribution(people, [], contributionInput)

    expect(people[0]).toBe(originalPerson)
    expect(people[0]).not.toHaveProperty('aportado')
  })

  it('rechaza una nueva aportación para una persona inexistente o inactiva', () => {
    expect(() =>
      addCashContribution(people, [], { ...contributionInput, personId: 'no-existe' }),
    ).toThrow(ContributionDomainError)
    expect(() =>
      addCashContribution(people, [], { ...contributionInput, personId: 'carmen' }),
    ).toThrow(ContributionDomainError)
  })

  it('usa exactamente la misma lógica para la aportación inicial y añadir efectivo', () => {
    const initialContribution = createInitialContribution(people, [], contributionInput)
    const cashContribution = addCashContribution(people, [], contributionInput)

    expect(initialContribution).toEqual(cashContribution)
  })

  it('mantiene compatibilidad de lectura con una aportación heredada firmada', () => {
    const historicalContribution: Contribution = {
      id: 'opening-v3',
      groupId: 'general',
      personId: 'ana',
      amountInCents: -100,
      date: null,
      source: 'v3-opening',
    }

    expect(calculateTotalContributedByPerson('ana', [historicalContribution])).toBe(-100)
  })
})
