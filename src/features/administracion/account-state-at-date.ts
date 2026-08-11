import { calculateGroupBalance, calculatePersonBalance } from '../../domain/financial-engine'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'

export interface AccountStateAtDatePerson {
  personId: string
  personName: string
  isActive: boolean
  contributedInCents: AmountInCents
  spentInCents: AmountInCents
  balanceInCents: AmountInCents
}

export interface AccountStateAtDateReport {
  groupId: string
  date: string
  people: readonly AccountStateAtDatePerson[]
  groupContributedInCents: AmountInCents
  groupSpentInCents: AmountInCents
  groupBalanceInCents: AmountInCents
}

function assertIsoDay(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('La fecha de consulta debe usar YYYY-MM-DD.')
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error('La fecha de consulta debe ser una fecha real.')
  }
}

/**
 * Estado a cierre de un día ISO. Las aperturas heredadas sin fecha representan
 * el saldo inicial previo al histórico fechado, por lo que siempre se incluyen
 * sin asignarles una fecha ficticia.
 */
export function createAccountStateAtDateReport(
  group: Group,
  people: readonly Person[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
  date: string,
): AccountStateAtDateReport {
  assertIsoDay(date)
  const contributionsUntilDate = contributions.filter((contribution) => (
    contribution.groupId === group.id
      && (contribution.date === null || contribution.date <= date)
  ))
  const expensesUntilDate = expenses.filter((expense) => expense.groupId === group.id && expense.date <= date)
  const groupPeople = people.filter((person) => person.groupId === group.id)
  const groupBalance = calculateGroupBalance(group.id, contributionsUntilDate, expensesUntilDate)

  return {
    groupId: group.id,
    date,
    people: groupPeople.map((person) => {
      const balance = calculatePersonBalance(person.id, group.id, contributionsUntilDate, expensesUntilDate)
      return {
        personId: person.id,
        personName: person.name,
        isActive: person.isActive,
        contributedInCents: balance.contributedInCents,
        spentInCents: balance.spentInCents,
        balanceInCents: balance.availableInCents,
      }
    }),
    groupContributedInCents: groupBalance.contributedInCents,
    groupSpentInCents: groupBalance.spentInCents,
    groupBalanceInCents: groupBalance.availableInCents,
  }
}
