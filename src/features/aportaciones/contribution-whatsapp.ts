import type { AmountInCents } from '../../domain/money'
import { createWhatsAppUrl } from '../informacion/account-whatsapp'
import { formatPdfDate, formatPdfMoney } from '../administracion/historical-pdf'

export interface ContributionReceipt {
  contributionId: string
  groupId: string
  personName: string
  phone: string
  groupName: string
  date: string
  amountInCents: AmountInCents
  balanceInCents?: AmountInCents
}

export const CONTRIBUTION_RECEIPT_STORAGE_KEY = 'gastos-v4:last-contribution-receipt'

export function contributionReceiptText(receipt: ContributionReceipt): string {
  const lines = [
    `Hola ${receipt.personName}.`,
    `Justificante de aportación · ${receipt.groupName}`,
    `Fecha: ${formatPdfDate(receipt.date)}`,
    `Importe aportado: ${formatPdfMoney(receipt.amountInCents)}`,
  ]
  if (receipt.balanceInCents !== undefined) {
    lines.push(`Saldo personal resultante: ${formatPdfMoney(receipt.balanceInCents)}`)
  }
  return lines.join('\n')
}

export function contributionReceiptWhatsAppUrl(receipt: ContributionReceipt): string | null {
  return createWhatsAppUrl(receipt.phone, contributionReceiptText(receipt))
}

function isContributionReceipt(value: unknown): value is ContributionReceipt {
  if (typeof value !== 'object' || value === null) return false
  const receipt = value as Partial<ContributionReceipt>
  return typeof receipt.contributionId === 'string'
    && typeof receipt.groupId === 'string'
    && typeof receipt.personName === 'string'
    && typeof receipt.phone === 'string'
    && typeof receipt.groupName === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(receipt.date ?? '')
    && Number.isSafeInteger(receipt.amountInCents)
    && (receipt.balanceInCents === undefined || Number.isSafeInteger(receipt.balanceInCents))
}

export function serializeContributionReceipt(receipt: ContributionReceipt): string {
  return JSON.stringify(receipt)
}

export function parseContributionReceipt(value: string | null, groupId: string): ContributionReceipt | null {
  if (value === null) return null
  try {
    const receipt: unknown = JSON.parse(value)
    return isContributionReceipt(receipt) && receipt.groupId === groupId ? receipt : null
  } catch {
    return null
  }
}
