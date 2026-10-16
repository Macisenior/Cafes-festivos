import { describe, expect, it } from 'vitest'
import {
  contributionReceiptText,
  contributionReceiptWhatsAppUrl,
  parseContributionReceipt,
  serializeContributionReceipt,
  type ContributionReceipt,
} from './contribution-whatsapp'

const receipt: ContributionReceipt = {
  contributionId: 'contribution-1',
  groupId: 'general',
  personName: 'Ana',
  phone: '600 123 456',
  groupName: 'Cafés Semanal',
  date: '2026-10-02',
  amountInCents: 2000,
  balanceInCents: 3142,
}

describe('justificante de aportación por WhatsApp', () => {
  it('incluye persona, grupo, fecha, importe y saldo verificado', () => {
    expect(contributionReceiptText(receipt)).toBe([
      'Hola Ana.',
      'Justificante de aportación · Cafés Semanal',
      'Fecha: 02/10/2026',
      'Importe aportado: 20,00 €',
      'Saldo personal resultante: 31,42 €',
    ].join('\n'))
  })

  it('omite el saldo cuando la lectura posterior no lo ha podido verificar', () => {
    const text = contributionReceiptText({ ...receipt, balanceInCents: undefined })
    expect(text).toContain('Importe aportado: 20,00 €')
    expect(text).not.toContain('Saldo personal')
  })

  it('crea el enlace para móvil o WhatsApp Web y rechaza teléfonos inválidos', () => {
    expect(contributionReceiptWhatsAppUrl(receipt)).toContain('https://wa.me/34600123456?text=')
    expect(decodeURIComponent(contributionReceiptWhatsAppUrl(receipt)!)).toContain('Saldo personal resultante: 31,42 €')
    expect(contributionReceiptWhatsAppUrl({ ...receipt, phone: '123' })).toBeNull()
  })

  it('recupera solo un justificante válido del grupo activo', () => {
    const serialized = serializeContributionReceipt(receipt)
    expect(parseContributionReceipt(serialized, 'general')).toEqual(receipt)
    expect(parseContributionReceipt(serialized, 'otro')).toBeNull()
    expect(parseContributionReceipt('{mal', 'general')).toBeNull()
  })
})
