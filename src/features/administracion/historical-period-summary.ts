import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'
import type { HistoricalFilters } from '../operativa/operational-history-filters'
import { createStateBetweenDatesReport } from './state-between-dates'

export interface HistoricalPeriodSummary {
  openingDate: string
  closingDate: string
  openingBalanceInCents: AmountInCents
  contributionsInPeriodInCents: AmountInCents
  expensesInPeriodInCents: AmountInCents
  periodBalanceInCents: AmountInCents
  closingBalanceInCents: AmountInCents
}

/**
 * Prepara saldos acumulados solo para un intervalo completo de todos los movimientos.
 * Apertura y cierre proceden de "Estado entre fechas" y, por tanto, del motor financiero V4.
 */
export function createHistoricalPeriodSummary(
  group: Group,
  people: readonly Person[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
  filters: HistoricalFilters,
): HistoricalPeriodSummary | null {
  if (filters.from === '' || filters.to === '' || filters.movementType !== 'all') return null

  const state = createStateBetweenDatesReport(group, people, contributions, expenses, filters.from, filters.to)
  const opening = filters.personId === ''
    ? { contributedInCents: state.opening.groupContributedInCents, spentInCents: state.opening.groupSpentInCents, balanceInCents: state.openingBalanceInCents }
    : state.opening.people.find((person) => person.personId === filters.personId)
  const closing = filters.personId === ''
    ? { contributedInCents: state.closing.groupContributedInCents, spentInCents: state.closing.groupSpentInCents, balanceInCents: state.closingBalanceInCents }
    : state.closing.people.find((person) => person.personId === filters.personId)

  if (opening === undefined || closing === undefined) return null

  const contributionsInPeriodInCents = closing.contributedInCents - opening.contributedInCents
  const expensesInPeriodInCents = closing.spentInCents - opening.spentInCents

  return {
    openingDate: state.openingDate,
    closingDate: state.to,
    openingBalanceInCents: opening.balanceInCents,
    contributionsInPeriodInCents,
    expensesInPeriodInCents,
    periodBalanceInCents: contributionsInPeriodInCents - expensesInPeriodInCents,
    closingBalanceInCents: closing.balanceInCents,
  }
}
