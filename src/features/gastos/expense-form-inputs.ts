import type { AmountInCents } from '../../domain/money'
import type { PersonId } from '../../domain/reparto'
import { eurosToCents, eurosToNonNegativeCents } from '../aportaciones/cash-contribution-request'

export interface IndividualAmountSummary {
  totalInCents: AmountInCents
  assignedInCents: AmountInCents
  matchesTotal: boolean
}

export interface IndividualAmountFeedback {
  totalInCents: AmountInCents | null
  assignedInCents: AmountInCents
  differenceInCents: AmountInCents | null
  status: 'matches' | 'missing' | 'excess' | 'awaiting-total'
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

/** Vista previa tolerante: muestra la suma desde el primer importe sin relajar la validación definitiva. */
export function previewIndividualAmounts(
  totalInEuros: string,
  participantIds: readonly PersonId[],
  amountsInEuros: Readonly<Record<PersonId, string>>,
): IndividualAmountFeedback {
  const assignedInCents = participantIds.reduce((sum, personId) => {
    const amountInEuros = amountsInEuros[personId]?.trim() ?? ''
    if (amountInEuros === '') return sum

    try {
      return sum + eurosToNonNegativeCents(amountInEuros)
    } catch {
      return sum
    }
  }, 0)

  try {
    const totalInCents = eurosToCents(totalInEuros)
    const differenceInCents = totalInCents - assignedInCents
    return {
      totalInCents,
      assignedInCents,
      differenceInCents,
      status: differenceInCents === 0 ? 'matches' : differenceInCents > 0 ? 'missing' : 'excess',
    }
  } catch {
    return { totalInCents: null, assignedInCents, differenceInCents: null, status: 'awaiting-total' }
  }
}

/** Validación estricta de la suma; createExpense mantiene la validación definitiva. */
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
