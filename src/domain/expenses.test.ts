import { describe, expect, it } from 'vitest'
import { ExpenseDomainError, createExpense } from './expenses'
import type { Group, Person } from './entities'
import { FinancialDomainError } from './financial-engine'

const group: Group = {
  id: 'general',
  name: 'Grupo de prueba',
  isMainGroup: true,
  siteOptions: [{ id: 'flap', name: 'Flap' }],
}

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
  { id: 'carlos', groupId: 'general', name: 'Carlos', phone: '', isActive: true },
  { id: 'inactiva', groupId: 'general', name: 'Inactiva', phone: '', isActive: false },
]

const baseInput = {
  id: 'expense-1',
  groupId: 'general',
  date: '2026-08-09',
  siteName: 'Flap',
  concept: 'Cafés',
  totalInCents: 1000,
  participantIds: ['ana', 'bea', 'carlos'],
  distribution: { mode: 'igual' as const },
}

describe('creación de gastos V4', () => {
  it('acepta un sitio predefinido del grupo', () => {
    expect(createExpense(group, people, [], baseInput).siteName).toBe('Flap')
  })

  it('acepta un sitio manual y guarda su nombre sin espacios exteriores', () => {
    expect(createExpense(group, people, [], { ...baseInput, siteName: '  Bar de la Plaza  ' }).siteName)
      .toBe('Bar de la Plaza')
  })

  it.each(['', '   '])('rechaza un sitio vacío o compuesto solo por espacios', (siteName) => {
    expect(() => createExpense(group, people, [], { ...baseInput, siteName })).toThrow(ExpenseDomainError)
  })
  it('crea un reparto Igual con ajuste determinista de céntimos del motor', () => {
    const expense = createExpense(group, people, [], baseInput)

    expect(expense.allocations).toEqual([
      { personId: 'ana', amountInCents: 334 },
      { personId: 'bea', amountInCents: 333 },
      { personId: 'carlos', amountInCents: 333 },
    ])
  })

  it('crea un reparto por Consumiciones mediante el motor', () => {
    const expense = createExpense(group, people, [], {
      ...baseInput,
      totalInCents: 1000,
      distribution: {
        mode: 'consumiciones',
        consumptionsByPersonId: { ana: 2, bea: 1, carlos: 1 },
      },
    })

    expect(expense.allocations).toEqual([
      { personId: 'ana', amountInCents: 500 },
      { personId: 'bea', amountInCents: 250 },
      { personId: 'carlos', amountInCents: 250 },
    ])
  })

  it('crea un reparto por Importe por persona cuando suma exactamente el total', () => {
    const expense = createExpense(group, people, [], {
      ...baseInput,
      distribution: {
        mode: 'importe',
        amountsByPersonId: { ana: 400, bea: 350, carlos: 250 },
      },
    })

    expect(expense.allocations).toEqual([
      { personId: 'ana', amountInCents: 400 },
      { personId: 'bea', amountInCents: 350 },
      { personId: 'carlos', amountInCents: 250 },
    ])
  })

  it('permite un único participante', () => {
    const expense = createExpense(group, people, [], {
      ...baseInput,
      participantIds: ['ana'],
    })

    expect(expense.allocations).toEqual([{ personId: 'ana', amountInCents: 1000 }])
  })

  it('rechaza participantes duplicados', () => {
    expect(() =>
      createExpense(group, people, [], { ...baseInput, participantIds: ['ana', 'ana'] }),
    ).toThrow(ExpenseDomainError)
  })

  it('rechaza una persona inactiva', () => {
    expect(() =>
      createExpense(group, people, [], { ...baseInput, participantIds: ['ana', 'inactiva'] }),
    ).toThrow(ExpenseDomainError)
  })

  it('rechaza consumiciones no positivas', () => {
    expect(() =>
      createExpense(group, people, [], {
        ...baseInput,
        distribution: {
          mode: 'consumiciones',
          consumptionsByPersonId: { ana: 1, bea: 0, carlos: 1 },
        },
      }),
    ).toThrow(FinancialDomainError)
  })

  it.each([0, -1])('rechaza el importe total no positivo %i', (totalInCents) => {
    expect(() => createExpense(group, people, [], { ...baseInput, totalInCents })).toThrow(
      ExpenseDomainError,
    )
  })

  it('rechaza un reparto por importes individuales que no suma exactamente el total', () => {
    expect(() =>
      createExpense(group, people, [], {
        ...baseInput,
        distribution: {
          mode: 'importe',
          amountsByPersonId: { ana: 400, bea: 300, carlos: 200 },
        },
      }),
    ).toThrow(FinancialDomainError)
  })
})
