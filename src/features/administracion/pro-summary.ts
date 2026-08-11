import { calculatePersonBalance } from '../../domain/financial-engine'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'

export interface ProSummaryContribution {
  id: string
  date: string
  amountInCents: AmountInCents
}

export interface ProSummaryPerson {
  personId: string
  name: string
  isActive: boolean
  openingContributions: readonly Contribution[]
  datedContributions: readonly ProSummaryContribution[]
  totalContributedInCents: AmountInCents
  totalSpentInCents: AmountInCents
  balanceInCents: AmountInCents
}

/** Compone el detalle PRO sin recalcular repartos ni usar acumulados de Person. */
export function createProSummary(
  group: Group,
  people: readonly Person[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
): readonly ProSummaryPerson[] {
  const groupContributions = contributions.filter((contribution) => contribution.groupId === group.id)
  const groupExpenses = expenses.filter((expense) => expense.groupId === group.id)

  return people.filter((person) => person.groupId === group.id).map((person) => {
    const balance = calculatePersonBalance(person.id, group.id, groupContributions, groupExpenses)
    const personContributions = groupContributions.filter((contribution) => contribution.personId === person.id)
    return {
      personId: person.id,
      name: person.name,
      isActive: person.isActive,
      openingContributions: personContributions.filter((contribution) => contribution.source === 'v3-opening'),
      datedContributions: personContributions
        .filter((contribution): contribution is Contribution & { date: string } => contribution.date !== null && contribution.source !== 'v3-opening')
        .map((contribution) => ({ id: contribution.id, date: contribution.date, amountInCents: contribution.amountInCents }))
        .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id)),
      totalContributedInCents: balance.contributedInCents,
      totalSpentInCents: balance.spentInCents,
      balanceInCents: balance.availableInCents,
    }
  })
}
