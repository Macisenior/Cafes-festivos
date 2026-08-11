import { deleteDoc, doc, setDoc, type Firestore } from 'firebase/firestore'
import { editExpense, type EditExpenseInput } from '../../domain/expenses'
import type { Expense, ExpenseId, Group, GroupId, Person } from '../../domain/entities'
import { V4_GROUPS_COLLECTION } from './v4-group-records'

export class FirestoreV4ExpensePathError extends Error {}
export class FirestoreV4ExpenseScopeError extends Error {}

export interface V4ExpenseLocation {
  rootCollection: typeof V4_GROUPS_COLLECTION
  groupId: GroupId
  expenseId: ExpenseId
}

export interface V4ExpensePersistencePort {
  create(location: V4ExpenseLocation, expense: Expense): Promise<void>
  update(location: V4ExpenseLocation, expense: Expense): Promise<void>
  delete(location: V4ExpenseLocation): Promise<void>
}

function assertPathSegment(value: string, label: string): void {
  if (value.trim().length === 0 || value.includes('/')) {
    throw new FirestoreV4ExpensePathError(`${label} debe ser un identificador, no una ruta.`)
  }
}

function createV4ExpenseLocation(groupId: GroupId, expenseId: ExpenseId): V4ExpenseLocation {
  assertPathSegment(groupId, 'El identificador de grupo')
  assertPathSegment(expenseId, 'El identificador de gasto')

  return {
    rootCollection: V4_GROUPS_COLLECTION,
    groupId,
    expenseId,
  }
}

/** Adaptador limitado a grupos_v4/{grupo}/gastos/{gasto}. */
export class FirestoreV4ExpensePersistence implements V4ExpensePersistencePort {
  private readonly firestore: Firestore

  constructor(firestore: Firestore) {
    this.firestore = firestore
  }

  async create(location: V4ExpenseLocation, expense: Expense): Promise<void> {
    await this.write(location, expense)
  }

  async update(location: V4ExpenseLocation, expense: Expense): Promise<void> {
    await this.write(location, expense)
  }

  private async write(location: V4ExpenseLocation, expense: Expense): Promise<void> {
    await setDoc(
      doc(
        this.firestore,
        location.rootCollection,
        location.groupId,
        'gastos',
        location.expenseId,
      ),
      expense,
    )
  }

  async delete(location: V4ExpenseLocation): Promise<void> {
    await deleteDoc(
      doc(this.firestore, location.rootCollection, location.groupId, 'gastos', location.expenseId),
    )
  }

}

/**
 * Persistencia de un gasto V4 ya validado. No calcula repartos ni modifica
 * personas, aportaciones, el documento de grupo o datos V3.
 */
export class FirestoreV4ExpenseService {
  private readonly persistence: V4ExpensePersistencePort

  constructor(persistence: V4ExpensePersistencePort) {
    this.persistence = persistence
  }

  async create(expense: Expense): Promise<void> {
    const location = createV4ExpenseLocation(expense.groupId, expense.id)
    await this.persistence.create(location, expense)
  }

  /**
   * Valida y reconstruye el gasto en el dominio antes de sobrescribir solo su
   * documento V4. No toca aportaciones, personas ni otros gastos.
   */
  async edit(
    group: Group,
    people: readonly Person[],
    expenses: readonly Expense[],
    expenseId: ExpenseId,
    input: EditExpenseInput,
  ): Promise<Expense> {
    const location = createV4ExpenseLocation(group.id, expenseId)
    const expenseWithRequestedId = expenses.find((expense) => expense.id === expenseId)
    if (expenseWithRequestedId !== undefined && expenseWithRequestedId.groupId !== group.id) {
      throw new FirestoreV4ExpenseScopeError('El gasto no pertenece al grupo activo.')
    }
    const updatedExpense = editExpense(group, people, expenses, expenseId, input)
    await this.persistence.update(location, updatedExpense)
    return updatedExpense
  }

  async delete(groupId: GroupId, expense: Expense): Promise<void> {
    if (expense.groupId !== groupId) {
      throw new FirestoreV4ExpenseScopeError('El gasto no pertenece al grupo activo.')
    }

    await this.persistence.delete(createV4ExpenseLocation(groupId, expense.id))
  }

}
