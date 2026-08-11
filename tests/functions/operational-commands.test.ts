import { describe, expect, it } from 'vitest'
import type { Group, Person } from '../../src/domain/entities'
import {
  createCashContributionCommand,
  createExpenseCommand,
  OperationalAuthorizationError,
  type OperationalGroupSnapshot,
  type OperationalWritePort,
} from '../../functions/src/operational-commands'

const group: Group = {
  id: 'general',
  name: 'Cafés Semanal',
  isMainGroup: true,
  siteOptions: [{ id: 'flap', name: 'Flap' }],
}
const people: readonly Person[] = [
  { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true },
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: false },
]

function createWrites(snapshot: OperationalGroupSnapshot = { group, people, contributions: [], expenses: [] }) {
  const contributions: unknown[] = []
  const expenses: unknown[] = []
  const writes: OperationalWritePort = {
    readGroup: async () => snapshot,
    createContribution: async (contribution) => { contributions.push(contribution) },
    createExpense: async (expense) => { expenses.push(expense) },
  }
  return { writes, contributions, expenses }
}

describe('comandos operativos V4 protegidos por PIN de servidor', () => {
  it('crea una aportación válida usando la regla de dominio existente', async () => {
    const { writes, contributions } = createWrites()
    const contribution = await createCashContributionCommand({
      pin: 'operativa-segura',
      input: { id: 'cash-1', groupId: 'general', personId: 'pepe', amountInCents: 100, date: '2026-08-10' },
    }, 'operativa-segura', writes)

    expect(contribution.amountInCents).toBe(100)
    expect(contribution.source).toBe('user')
    expect(contributions).toEqual([contribution])
  })

  it('rechaza un PIN operativo incorrecto antes de escribir', async () => {
    const { writes, contributions } = createWrites()
    await expect(createCashContributionCommand({
      pin: 'incorrecto',
      input: { id: 'cash-1', groupId: 'general', personId: 'pepe', amountInCents: 100, date: '2026-08-10' },
    }, 'operativa-segura', writes)).rejects.toBeInstanceOf(OperationalAuthorizationError)
    expect(contributions).toEqual([])
  })

  it('propaga las validaciones del dominio para aportaciones inválidas', async () => {
    const { writes, contributions } = createWrites()
    await expect(createCashContributionCommand({
      pin: 'operativa-segura',
      input: { id: 'cash-1', groupId: 'general', personId: 'ana', amountInCents: 0, date: '2026-08-10' },
    }, 'operativa-segura', writes)).rejects.toThrow('importe')
    expect(contributions).toEqual([])
  })

  it('crea un gasto válido con las asignaciones del motor financiero existente', async () => {
    const { writes, expenses } = createWrites()
    const expense = await createExpenseCommand({
      pin: 'operativa-segura',
      input: {
        id: 'expense-1', groupId: 'general', date: '2026-08-10', siteName: 'Flap', concept: 'Cafés',
        totalInCents: 101, participantIds: ['pepe'], distribution: { mode: 'igual' },
      },
    }, 'operativa-segura', writes)

    expect(expense.allocations).toEqual([{ personId: 'pepe', amountInCents: 101 }])
    expect(expenses).toEqual([expense])
  })

  it('rechaza gastos inválidos mediante el dominio sin persistirlos', async () => {
    const { writes, expenses } = createWrites()
    await expect(createExpenseCommand({
      pin: 'operativa-segura',
      input: {
        id: 'expense-1', groupId: 'general', date: '2026-08-10', siteName: 'Flap', concept: 'Cafés',
        totalInCents: 100, participantIds: ['pepe'], distribution: { mode: 'importe', amountsByPersonId: { pepe: 99 } },
      },
    }, 'operativa-segura', writes)).rejects.toThrow()
    expect(expenses).toEqual([])
  })
})
