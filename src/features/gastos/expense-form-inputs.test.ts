import { describe, expect, it } from 'vitest'
import { summarizeIndividualAmounts } from './expense-form-inputs'

describe('entradas de reparto por importe', () => {
  it('convierte importes individuales a céntimos y confirma la suma exacta', () => {
    expect(
      summarizeIndividualAmounts('10,00', ['ana', 'bea'], { ana: '6,25', bea: '3,75' }),
    ).toEqual({ totalInCents: 1000, assignedInCents: 1000, matchesTotal: true })
  })

  it('detecta una suma individual distinta del total antes de enviar', () => {
    expect(
      summarizeIndividualAmounts('10,00', ['ana', 'bea'], { ana: '6,00', bea: '3,75' }),
    ).toEqual({ totalInCents: 1000, assignedInCents: 975, matchesTotal: false })
  })
})
