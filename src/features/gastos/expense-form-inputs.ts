import type { AmountInCents } from '../../domain/money'
import type { PersonId } from '../../domain/reparto'
import { eurosToCents, eurosToNonNegativeCents } from '../aportaciones/cash-contribution-request'

export interface IndividualAmountSummary {
  totalInCents: AmountInCents
  assignedInCents: AmountInCents
  matchesTotal: boolean
}

/** Convierte los importes introducidos sin aplicar ningún algoritmo de reparto. */
export function individualAmountsInCents(
  participantIds: readonly PersonId[],
  amountsInEuros: Readonly<Record<PersonId, string>>,
): Readonly<Record<PersonId, AmountInCents>> {
  return Object.fromEntries(
    participantIds.map((personId) => [personId, eurosToNonNegativeCents(amountsInEuros[personId] ?? '')]),
  )
}

/** Validación visual de la suma; createExpense mantiene la validación definitiva. */
export function summarizeIndividualAmounts(
  totalInEuros: string,
  participantIds: readonly PersonId[],
  amountsInEuros: Readonly<Record<PersonId, string>>,
): IndividualAmountSummary {
  const totalInCents = eurosToCents(totalInEuros)
  const amounts = individualAmountsInCents(participantIds, amountsInEuros)
  const assignedInCents = Object.values(amounts).reduce((total, amount) => total + amount, 0)

  return { totalInCents, assignedInCents, matchesTotal: totalInCents === assignedInCents }
}
