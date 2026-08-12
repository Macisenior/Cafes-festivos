import { describe, expect, it } from 'vitest'
import { previewIndividualAmounts, summarizeIndividualAmounts } from './expense-form-inputs'

describe('entradas de reparto por importe', () => {
  it('convierte importes individuales a céntimos y confirma la suma exacta', () => {
    expect(
      summarizeIndividualAmounts('10,00', ['ana', 'bea'], { ana: '6,25', bea: '3,75' }),
    ).toEqual({ totalInCents: 1000, assignedInCents: 1000, matchesTotal: true })
  })

  it('muestra desde el primer importe cuánto falta para completar el total', () => {
    expect(
      previewIndividualAmounts('10,00', ['ana', 'bea', 'carlos'], { ana: '3,00', bea: '5,00', carlos: '' }),
    ).toEqual({ totalInCents: 1000, assignedInCents: 800, differenceInCents: 200, status: 'missing' })
  })

  it('indica coincidencia exacta y exceso sin esperar a que todos los campos sean válidos', () => {
    expect(
      previewIndividualAmounts('10,00', ['ana', 'bea', 'carlos'], { ana: '3,00', bea: '5,00', carlos: '2,00' }),
    ).toEqual({ totalInCents: 1000, assignedInCents: 1000, differenceInCents: 0, status: 'matches' })
    expect(
      previewIndividualAmounts('10,00', ['ana', 'bea'], { ana: '6,00', bea: '5,00' }),
    ).toEqual({ totalInCents: 1000, assignedInCents: 1100, differenceInCents: -100, status: 'excess' })
  })
  it('detecta una suma individual distinta del total antes de enviar', () => {
    expect(
      summarizeIndividualAmounts('10,00', ['ana', 'bea'], { ana: '6,00', bea: '3,75' }),
    ).toEqual({ totalInCents: 1000, assignedInCents: 975, matchesTotal: false })
  })
})
