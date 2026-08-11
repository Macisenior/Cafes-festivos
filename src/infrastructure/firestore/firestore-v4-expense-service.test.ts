import { describe, expect, it } from 'vitest'
import type { Expense, Group, Person } from '../../domain/entities'
import {
  FirestoreV4ExpensePathError,
  FirestoreV4ExpenseScopeError,
  FirestoreV4ExpenseService,
  type V4ExpenseLocation,
  type V4ExpensePersistencePort,
} from './firestore-v4-expense-service'

class RecordingExpensePersistence implements V4ExpensePersistencePort {
  readonly writes: Array<{ location: V4ExpenseLocation; expense: Expense }> = []
  readonly updates: Array<{ location: V4ExpenseLocation; expense: Expense }> = []
  readonly deletions: V4ExpenseLocation[] = []

  async create(location: V4ExpenseLocation, expense: Expense): Promise<void> {
    this.writes.push({ location, expense })
  }

  async update(location: V4ExpenseLocation, expense: Expense): Promise<void> {
    this.updates.push({ location, expense })
  }

  async delete(location: V4ExpenseLocation): Promise<void> {
    this.deletions.push(location)
  }

}

const group: Group = {
  id: 'general',
  name: 'General',
  isMainGroup: true,
  siteOptions: [{ id: 'flap', name: 'Flap' }],
}

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
]

const expense: Expense = {
  id: 'expense-1',
  groupId: 'general',
  date: '2026-08-09',
  siteName: 'Flap',
  concept: 'Cafés',
  totalInCents: 1001,
  participantIds: ['ana', 'bea'],
  distribution: {
    mode: 'consumiciones',
    consumptionsByPersonId: { ana: 2, bea: 1 },
  },
  allocations: [
    { personId: 'ana', amountInCents: 667 },
    { personId: 'bea', amountInCents: 334 },
  ],
}

describe('FirestoreV4ExpenseService', () => {
  it('crea un único documento V4 con todos los datos finales del gasto', async () => {
    const persistence = new RecordingExpensePersistence()
    const service = new FirestoreV4ExpenseService(persistence)

    await service.create(expense)

    expect(persistence.writes).toEqual([
      {
        location: {
          rootCollection: 'grupos_v4',
          groupId: 'general',
          expenseId: 'expense-1',
        },
        expense: {
          id: 'expense-1',
          groupId: 'general',
          date: '2026-08-09',
          siteName: 'Flap',
          concept: 'Cafés',
          totalInCents: 1001,
          participantIds: ['ana', 'bea'],
          distribution: {
            mode: 'consumiciones',
            consumptionsByPersonId: { ana: 2, bea: 1 },
          },
          allocations: [
            { personId: 'ana', amountInCents: 667 },
            { personId: 'bea', amountInCents: 334 },
          ],
        },
      },
    ])
    expect(persistence.writes).toHaveLength(1)
  })

  it('rechaza una ruta de grupo V3 o malformada antes de persistir', async () => {
    const persistence = new RecordingExpensePersistence()
    const service = new FirestoreV4ExpenseService(persistence)

    await expect(service.create({ ...expense, groupId: 'grupos/general' })).rejects.toBeInstanceOf(
      FirestoreV4ExpensePathError,
    )
    await expect(service.create({ ...expense, id: 'gastos/expense-1' })).rejects.toBeInstanceOf(
      FirestoreV4ExpensePathError,
    )
    expect(persistence.writes).toEqual([])
  })

  it('aísla las operaciones por groupId dentro de la ruta V4', async () => {
    const persistence = new RecordingExpensePersistence()
    const service = new FirestoreV4ExpenseService(persistence)

    await service.create({ ...expense, id: 'expense-general', groupId: 'general' })
    await service.create({ ...expense, id: 'expense-viernes', groupId: 'viernes-oficial' })

    expect(persistence.writes.map((write) => write.location)).toEqual([
      { rootCollection: 'grupos_v4', groupId: 'general', expenseId: 'expense-general' },
      { rootCollection: 'grupos_v4', groupId: 'viernes-oficial', expenseId: 'expense-viernes' },
    ])
  })

  it('edita exclusivamente el documento V4 del gasto con su mismo identificador', async () => {
    const persistence = new RecordingExpensePersistence()
    const service = new FirestoreV4ExpenseService(persistence)

    const updated = await service.edit(group, people, [expense], expense.id, {
      date: '2026-08-10',
      siteName: 'Flap',
      concept: 'Cafes editados',
      totalInCents: 1000,
      participantIds: ['ana', 'bea'],
      distribution: { mode: 'igual' },
    })

    expect(updated.id).toBe(expense.id)
    expect(persistence.updates).toHaveLength(1)
    expect(persistence.updates[0]).toMatchObject({
      location: { rootCollection: 'grupos_v4', groupId: 'general', expenseId: 'expense-1' },
      expense: {
        id: 'expense-1',
        groupId: 'general',
        concept: 'Cafes editados',
        allocations: [
          { personId: 'ana', amountInCents: 500 },
          { personId: 'bea', amountInCents: 500 },
        ],
      },
    })
    expect(persistence.writes).toEqual([])
    expect(persistence.deletions).toEqual([])
  })

  it('rechaza editar un gasto fuera del grupo activo sin escribir', async () => {
    const persistence = new RecordingExpensePersistence()
    const service = new FirestoreV4ExpenseService(persistence)

    await expect(service.edit(group, people, [{ ...expense, groupId: 'otro-grupo' }], expense.id, {
      date: expense.date,
      siteName: expense.siteName,
      concept: expense.concept,
      totalInCents: expense.totalInCents,
      participantIds: expense.participantIds,
      distribution: expense.distribution,
    })).rejects.toBeInstanceOf(FirestoreV4ExpenseScopeError)
    expect(persistence.updates).toEqual([])
  })

  it('elimina únicamente el documento seleccionado dentro de su grupo V4', async () => {
    const persistence = new RecordingExpensePersistence()
    const service = new FirestoreV4ExpenseService(persistence)

    await service.delete('Viernes Oficial', { ...expense, id: 'expense-viernes', groupId: 'Viernes Oficial' })

    expect(persistence.deletions).toEqual([
      { rootCollection: 'grupos_v4', groupId: 'Viernes Oficial', expenseId: 'expense-viernes' },
    ])
    expect(persistence.writes).toEqual([])
  })

  it('rechaza la eliminación con una ruta V3 o malformada', async () => {
    const persistence = new RecordingExpensePersistence()
    const service = new FirestoreV4ExpenseService(persistence)

    await expect(service.delete('grupos/general', { ...expense, groupId: 'grupos/general' })).rejects.toBeInstanceOf(
      FirestoreV4ExpensePathError,
    )
    expect(persistence.deletions).toEqual([])
  })

  it('no permite eliminar un gasto de otro grupo activo', async () => {
    const persistence = new RecordingExpensePersistence()
    const service = new FirestoreV4ExpenseService(persistence)

    await expect(service.delete('general', { ...expense, groupId: 'Torreznos' })).rejects.toBeInstanceOf(
      FirestoreV4ExpenseScopeError,
    )
    expect(persistence.deletions).toEqual([])
  })
})
