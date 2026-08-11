import type { MovementDate } from './dates'
import type { Expense, ExpenseId, Group, GroupId, Person } from './entities'
import { calculateExpenseAllocations } from './financial-engine'
import type { AmountInCents } from './money'
import type { ExpenseDistribution, PersonId } from './reparto'

export class ExpenseDomainError extends Error {}

export interface NewExpenseInput {
  id: ExpenseId
  groupId: GroupId
  date: MovementDate
  siteName: string
  concept: string
  totalInCents: AmountInCents
  participantIds: readonly PersonId[]
  distribution: ExpenseDistribution
}

/** Datos que pueden cambiarse de un gasto ya existente. */
export type EditExpenseInput = Omit<NewExpenseInput, 'id' | 'groupId'>

function assertStableId(id: string): void {
  if (id.trim().length === 0) {
    throw new ExpenseDomainError('Un gasto necesita un identificador estable.')
  }
}

function assertMovementDate(date: MovementDate): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ExpenseDomainError('La fecha del gasto debe usar el formato YYYY-MM-DD.')
  }

  const [year, month, day] = date.split('-').map(Number)
  const parsedDate = new Date(Date.UTC(year, month - 1, day))

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new ExpenseDomainError('La fecha del gasto debe ser una fecha real.')
  }
}

function assertSite(group: Group, siteName: string): void {
  if (siteName.trim().length === 0 || !group.siteOptions.some((site) => site.name === siteName)) {
    throw new ExpenseDomainError('El sitio seleccionado no es válido para el grupo.')
  }
}

function assertConcept(concept: string): void {
  if (concept.trim().length === 0) {
    throw new ExpenseDomainError('El concepto del gasto es obligatorio.')
  }
}

function assertTotal(totalInCents: AmountInCents): void {
  if (!Number.isSafeInteger(totalInCents) || totalInCents <= 0) {
    throw new ExpenseDomainError('El importe total del gasto debe ser un número positivo de céntimos.')
  }
}

function assertParticipants(
  people: readonly Person[],
  groupId: GroupId,
  participantIds: readonly PersonId[],
): void {
  if (participantIds.length === 0) {
    throw new ExpenseDomainError('Un gasto debe tener al menos una persona participante.')
  }

  if (new Set(participantIds).size !== participantIds.length) {
    throw new ExpenseDomainError('Una persona solo puede participar una vez en un gasto.')
  }

  participantIds.forEach((participantId) => {
    const person = people.find((candidate) => candidate.id === participantId && candidate.groupId === groupId)

    if (person === undefined) {
      throw new ExpenseDomainError('Una persona participante no pertenece al grupo.')
    }

    if (!person.isActive) {
      throw new ExpenseDomainError('No se puede crear un gasto con una persona participante inactiva.')
    }
  })
}

/**
 * Crea un gasto V4 completo. El cálculo de las asignaciones se delega sin
 * excepciones en financial-engine.ts, que conserva el reparto canónico V4.
 */
export function createExpense(
  group: Group,
  people: readonly Person[],
  expenses: readonly Expense[],
  input: NewExpenseInput,
): Expense {
  assertStableId(input.id)

  if (input.groupId !== group.id) {
    throw new ExpenseDomainError('El gasto debe pertenecer al grupo proporcionado.')
  }

  if (expenses.some((expense) => expense.id === input.id)) {
    throw new ExpenseDomainError('Ya existe un gasto con ese identificador.')
  }

  assertMovementDate(input.date)
  assertSite(group, input.siteName)
  assertConcept(input.concept)
  assertTotal(input.totalInCents)
  assertParticipants(people, group.id, input.participantIds)

  const expenseWithoutAllocations: Expense = {
    id: input.id,
    groupId: input.groupId,
    date: input.date,
    siteName: input.siteName,
    concept: input.concept.trim(),
    totalInCents: input.totalInCents,
    participantIds: input.participantIds,
    distribution: input.distribution,
    allocations: [],
  }

  return {
    ...expenseWithoutAllocations,
    allocations: calculateExpenseAllocations(expenseWithoutAllocations),
  }
}

/**
 * Reconstruye un gasto existente con el mismo identificador y el reparto
 * canónico del motor V4. Las personas inactivas solo se aceptan cuando ya
 * formaban parte de ese gasto histórico; no se pueden añadir nuevas personas
 * inactivas durante una edición.
 */
export function editExpense(
  group: Group,
  people: readonly Person[],
  expenses: readonly Expense[],
  expenseId: ExpenseId,
  input: EditExpenseInput,
): Expense {
  const existingExpense = expenses.find(
    (expense) => expense.id === expenseId && expense.groupId === group.id,
  )

  if (existingExpense === undefined) {
    throw new ExpenseDomainError('El gasto que se quiere editar no pertenece al grupo proporcionado.')
  }

  const peopleAllowedForHistoricalEdition = people.map((person) => (
    person.groupId === group.id && !person.isActive && existingExpense.participantIds.includes(person.id)
      ? { ...person, isActive: true }
      : person
  ))

  return createExpense(
    group,
    peopleAllowedForHistoricalEdition,
    expenses.filter((expense) => expense.id !== existingExpense.id),
    {
      id: existingExpense.id,
      groupId: group.id,
      ...input,
    },
  )
}
