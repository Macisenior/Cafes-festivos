import type { GroupId } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'

export class CashContributionFormError extends Error {}

export interface CashContributionFormInput {
  id: string
  groupId: GroupId
  personId: string
  amountInEuros: string
  date: string
}

/** Convierte una entrada de euros con hasta dos decimales a céntimos exactos. */
function parseEuroCents(amountInEuros: string): AmountInCents {
  const normalizedAmount = amountInEuros.trim().replace(',', '.')

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedAmount)) {
    throw new CashContributionFormError('Introduce un importe positivo válido con un máximo de dos decimales.')
  }

  const [wholePart, decimalPart = ''] = normalizedAmount.split('.')
  const amountInCents = Number(wholePart) * 100 + Number(decimalPart.padEnd(2, '0'))

  return amountInCents
}

export function eurosToNonNegativeCents(amountInEuros: string): AmountInCents {
  const amountInCents = parseEuroCents(amountInEuros)

  if (!Number.isSafeInteger(amountInCents) || amountInCents < 0) {
    throw new CashContributionFormError('Introduce un importe válido.')
  }

  return amountInCents
}

export function eurosToCents(amountInEuros: string): AmountInCents {
  const amountInCents = eurosToNonNegativeCents(amountInEuros)

  if (amountInCents <= 0) {
    throw new CashContributionFormError('Introduce un importe positivo válido.')
  }

  return amountInCents
}
