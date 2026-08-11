import type { Expense, GroupId, Person } from '../../domain/entities'
import type { ExpenseDistributionMode } from '../../domain/reparto'

export type AdminExpensePeriod = 'current-month' | 'all'

export interface CompactParticipants {
  visibleNames: readonly string[]
  extraCount: number
}

export interface ExpenseAllocationDetail {
  personId: string
  personName: string
  amountInCents: number
}

export function expenseDistributionLabel(mode: ExpenseDistributionMode): string {
  return { igual: 'Igual', consumiciones: 'Consumiciones', importe: 'Importe por persona' }[mode]
}

export function currentMonthKey(referenceDate = new Date()): string {
  return `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`
}

/** Lista administrativa de consulta: filtra únicamente el grupo y periodo, y mantiene el orden reciente. */
export function visibleAdminExpenses(
  expenses: readonly Expense[],
  groupId: GroupId,
  period: AdminExpensePeriod,
  referenceDate = new Date(),
): readonly Expense[] {
  const month = currentMonthKey(referenceDate)
  return expenses
    .filter((expense) => expense.groupId === groupId && (period === 'all' || expense.date.startsWith(month)))
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
}

export function compactExpenseParticipants(
  expense: Expense,
  people: readonly Person[],
  maxVisible = 3,
): CompactParticipants {
  const peopleById = new Map(people.filter((person) => person.groupId === expense.groupId).map((person) => [person.id, person.name]))
  const names = expense.participantIds.map((personId) => peopleById.get(personId) ?? 'Persona no disponible')
  return { visibleNames: names.slice(0, maxVisible), extraCount: Math.max(0, names.length - maxVisible) }
}

/** Expone las asignaciones finales almacenadas; no recalcula el reparto. */
export function expenseAllocationDetails(expense: Expense, people: readonly Person[]): readonly ExpenseAllocationDetail[] {
  const peopleById = new Map(people.filter((person) => person.groupId === expense.groupId).map((person) => [person.id, person.name]))
  return expense.allocations.map((allocation) => ({
    personId: allocation.personId,
    personName: peopleById.get(allocation.personId) ?? 'Persona no disponible',
    amountInCents: allocation.amountInCents,
  }))
}
