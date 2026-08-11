import type { Contribution } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'

export interface SameDayContributionSummary {
  count: number
  totalInCents: AmountInCents
}

/** Resume movimientos reales, nunca acumulados, de una persona en una fecha. */
export function summarizeSameDayContributions(
  contributions: readonly Contribution[],
  personId: string,
  date: string,
): SameDayContributionSummary {
  const matches = contributions.filter(
    (contribution) => contribution.personId === personId && contribution.date === date,
  )

  return {
    count: matches.length,
    totalInCents: matches.reduce((total, contribution) => total + contribution.amountInCents, 0),
  }
}

export interface CashFormValues {
  personId: string
  amountInEuros: string
  date: string
}

/** Tras una escritura confirmada no se conserva la persona ni el importe previos. */
export function resetCashFormAfterSave(date: string): CashFormValues {
  return { personId: '', amountInEuros: '', date }
}
