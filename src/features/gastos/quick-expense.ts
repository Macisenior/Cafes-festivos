import { configuredQuickExpenseRecipient } from '../../config/quick-expense-config'
import type { Group, Person, QuickExpenseNotice } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'

export class QuickExpenseError extends Error {}

export interface QuickExpenseDraftInput {
  groupId: string
  siteName: string
  amountInCents: AmountInCents
  reportedPayerPersonId: string
  participantIds: readonly string[]
}

export interface QuickExpenseDraft extends QuickExpenseNotice {
  groupId: string
  participantIds: readonly string[]
  participantNames: readonly string[]
  reportedPayerName: string | null
}

function activeGroupPeople(people: readonly Person[], groupId: string): readonly Person[] {
  return people.filter((person) => person.groupId === groupId && person.isActive)
}

/** Prepara exclusivamente un mensaje; no crea gastos ni movimientos financieros. */
export function prepareQuickExpenseDraft(
  group: Group,
  people: readonly Person[],
  input: QuickExpenseDraftInput,
): QuickExpenseDraft {
  if (input.groupId !== group.id) throw new QuickExpenseError('El borrador debe pertenecer al grupo activo.')
  if (input.siteName.trim() === '') throw new QuickExpenseError('Selecciona un sitio.')
  if (!Number.isSafeInteger(input.amountInCents) || input.amountInCents <= 0) {
    throw new QuickExpenseError('Introduce un importe positivo válido.')
  }
  if (input.participantIds.length === 0) throw new QuickExpenseError('Selecciona al menos una persona.')
  if (new Set(input.participantIds).size !== input.participantIds.length) {
    throw new QuickExpenseError('No se puede repetir una persona en el borrador.')
  }

  const activePeople = activeGroupPeople(people, group.id)
  const participants = input.participantIds.map((personId) => activePeople.find((person) => person.id === personId))
  if (participants.some((person) => person === undefined)) {
    throw new QuickExpenseError('Las personas seleccionadas deben estar activas y pertenecer al grupo.')
  }
  const payer = input.reportedPayerPersonId === ''
    ? undefined
    : activePeople.find((person) => person.id === input.reportedPayerPersonId)
  if (input.reportedPayerPersonId !== '' && payer === undefined) {
    throw new QuickExpenseError('La persona que paga debe estar activa y pertenecer al grupo.')
  }

  return {
    groupId: group.id,
    amountInCents: input.amountInCents,
    siteName: input.siteName.trim(),
    reportedPayerPersonId: payer?.id,
    reportedPayerName: payer?.name ?? null,
    participantIds: [...input.participantIds],
    participantNames: participants.map((person) => person!.name),
  }
}

function formatQuickExpenseMoney(amountInCents: AmountInCents): string {
  return `${Math.floor(amountInCents / 100)},${String(amountInCents % 100).padStart(2, '0')} €`
}

export function createQuickExpenseWhatsAppMessage(draft: QuickExpenseDraft): string {
  return [
    '📝 Gasto rápido',
    '',
    `📍 ${draft.siteName ?? 'Sitio no indicado'}`,
    `💸 ${formatQuickExpenseMoney(draft.amountInCents)}`,
    `💳 Pagado por: ${draft.reportedPayerName ?? 'No indicado'}`,
    `👥 ${draft.participantNames.join(', ')}`,
  ].join('\n')
}

/** Crea un enlace solo si existe un destinatario válido configurado de forma centralizada. */
export function createQuickExpenseWhatsAppUrl(
  draft: QuickExpenseDraft,
  recipientPhone?: string | null,
): string | null {
  const recipient = recipientPhone === undefined
    ? configuredQuickExpenseRecipient()
    : configuredQuickExpenseRecipient(recipientPhone ?? '')
  return recipient === null ? null : `https://wa.me/${recipient}?text=${encodeURIComponent(createQuickExpenseWhatsAppMessage(draft))}`
}