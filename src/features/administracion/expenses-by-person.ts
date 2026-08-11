import type { Expense, GroupId, Person } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'

export interface ExpenseByPersonDateRange {
  from: string
  to: string
}

export interface ExpenseByPersonItem {
  personId: string
  personName: string
  isActive: boolean
  spentInCents: AmountInCents
}

export interface ExpensesByPersonReport {
  groupId: GroupId
  range: ExpenseByPersonDateRange
  people: readonly ExpenseByPersonItem[]
  totalExpensesInCents: AmountInCents
  totalAssignedInCents: AmountInCents
}

export const EMPTY_EXPENSES_BY_PERSON_RANGE: ExpenseByPersonDateRange = { from: '', to: '' }

function isInInclusiveRange(date: string, range: ExpenseByPersonDateRange): boolean {
  return (range.from === '' || date >= range.from) && (range.to === '' || date <= range.to)
}

/**
 * Informa consumos reales a partir de las asignaciones finales ya guardadas.
 * No usa aportaciones, saldos ni recalcula ningún reparto.
 */
export function createExpensesByPersonReport(
  groupId: GroupId,
  people: readonly Person[],
  expenses: readonly Expense[],
  range: ExpenseByPersonDateRange = EMPTY_EXPENSES_BY_PERSON_RANGE,
): ExpensesByPersonReport {
  const groupPeople = people.filter((person) => person.groupId === groupId)
  const assignedByPersonId = new Map(groupPeople.map((person) => [person.id, 0]))
  const includedExpenses = expenses.filter((expense) => expense.groupId === groupId && isInInclusiveRange(expense.date, range))

  includedExpenses.forEach((expense) => {
    expense.allocations.forEach((allocation) => {
      if (assignedByPersonId.has(allocation.personId)) {
        assignedByPersonId.set(allocation.personId, (assignedByPersonId.get(allocation.personId) ?? 0) + allocation.amountInCents)
      }
    })
  })

  return {
    groupId,
    range,
    people: groupPeople.map((person) => ({
      personId: person.id,
      personName: person.name,
      isActive: person.isActive,
      spentInCents: assignedByPersonId.get(person.id) ?? 0,
    })),
    totalExpensesInCents: includedExpenses.reduce((total, expense) => total + expense.totalInCents, 0),
    totalAssignedInCents: [...assignedByPersonId.values()].reduce((total, amount) => total + amount, 0),
  }
}
