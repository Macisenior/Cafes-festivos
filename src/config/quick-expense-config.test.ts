import { describe, expect, it } from 'vitest'
import { configuredQuickExpenseRecipient } from './quick-expense-config'

describe('configuración del teléfono administrador de Gasto rápido', () => {
  it('acepta únicamente el formato internacional español sin separadores', () => {
    expect(configuredQuickExpenseRecipient('34600123456')).toBe('34600123456')
  })

  it('rechaza una configuración vacía, con símbolos o fuera del formato español para no construir un enlace wa.me', () => {
    expect(configuredQuickExpenseRecipient('')).toBeNull()
    expect(configuredQuickExpenseRecipient('+34 600 123 456')).toBeNull()
    expect(configuredQuickExpenseRecipient('600123456')).toBeNull()
    expect(configuredQuickExpenseRecipient('3490012345')).toBeNull()
  })
})