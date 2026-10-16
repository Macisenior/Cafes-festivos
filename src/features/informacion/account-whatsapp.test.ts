import { describe, expect, it } from 'vitest'
import { createPendingBalanceWhatsAppUrl, createWhatsAppUrl, normalizeWhatsAppPhone } from './account-whatsapp'

describe('WhatsApp de saldo pendiente', () => {
  it('prepara un enlace manual solo para un saldo negativo y un teléfono válido', () => {
    const url = createPendingBalanceWhatsAppUrl('Pepe', '600 123 456', -1234, 'Cafés Semanal')

    expect(url).toContain('https://wa.me/34600123456?text=')
    expect(decodeURIComponent(url!)).toContain('Hola Pepe, tienes pendiente 12,34 € en Cafés Semanal.')
  })

  it('no prepara un enlace sin teléfono válido ni para saldos no pendientes', () => {
    expect(createPendingBalanceWhatsAppUrl('Pepe', '', -100, 'Grupo')).toBeNull()
    expect(createPendingBalanceWhatsAppUrl('Pepe', '600123456', 0, 'Grupo')).toBeNull()
    expect(createPendingBalanceWhatsAppUrl('Pepe', '600123456', 100, 'Grupo')).toBeNull()
  })

  it('reutiliza una normalización internacional estricta para cualquier mensaje', () => {
    expect(normalizeWhatsAppPhone('+34 600-123-456')).toBe('34600123456')
    expect(normalizeWhatsAppPhone('600 123 456')).toBe('34600123456')
    expect(normalizeWhatsAppPhone('123')).toBeNull()
    expect(createWhatsAppUrl('600123456', 'Hola')).toBe('https://wa.me/34600123456?text=Hola')
  })
})
