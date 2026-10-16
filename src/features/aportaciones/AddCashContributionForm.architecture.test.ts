/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./AddCashContributionForm.tsx', import.meta.url)), 'utf8')

describe('flujo del justificante de aportación', () => {
  it('reserva la pestaña desde el gesto y no la dirige a WhatsApp hasta confirmar Firebase', () => {
    const placeholder = source.indexOf('openWhatsAppPlaceholder()')
    const save = source.indexOf('await new FirestoreV4OperationalFunctionsClient().createCashContribution')
    const redirect = source.indexOf('receiptWindow.location.replace(whatsAppUrl)')

    expect(placeholder).toBeGreaterThan(-1)
    expect(placeholder).toBeLessThan(save)
    expect(save).toBeLessThan(redirect)
  })

  it('recupera y copia el justificante sin volver a ejecutar el alta', () => {
    expect(source).toContain('sessionStorage.setItem(CONTRIBUTION_RECEIPT_STORAGE_KEY')
    expect(source).toContain('Abrir WhatsApp')
    expect(source).toContain('Copiar justificante')
    expect(source.match(/createCashContribution\(/g)).toHaveLength(1)
  })

  it('comprueba el mismo ID tras una respuesta de escritura ambigua para evitar duplicados', () => {
    expect(source).toContain('item.id === pending.input.id')
    expect(source).toContain('if (verifiedContribution === undefined) throw writeError')
  })
})
