import { describe, expect, it } from 'vitest'
import type { ContributionsByPersonReport } from './contributions-by-person'
import { createStyledPdfDocument, createStyledPdfPages } from './historical-pdf'
import { prepareContributionsByPersonPdf } from './contributions-by-person-pdf'

const report: ContributionsByPersonReport = {
  groupId: 'general',
  range: { from: '', to: '' },
  people: [
    { personId: 'pepe', personName: 'Pepe', isActive: false, contributedInCents: 68300 },
    { personId: 'ana', personName: 'Ana', isActive: true, contributedInCents: -100 },
  ],
  includedContributionCount: 3,
  totalContributionsInCents: 68200,
}

describe('PDF de Aportaciones por persona', () => {
  it('usa exactamente el informe preparado para pantalla, sin recalcular totales', () => {
    const pdf = prepareContributionsByPersonPdf('Cafés Semanal', report, '10/08/2026 12:00')

    expect(pdf?.rows.map((row) => row.amountInCents)).toEqual([68300, -100])
    expect(pdf?.summary).toEqual([{ label: 'TOTAL APORTACIONES', amountInCents: 68200, tone: 'positive' }])
    expect(pdf?.filters).toEqual(['Rango: Todo el histórico (incluye aperturas sin fecha)'])
  })

  it('reutiliza formato y plantilla V4 para personas inactivas e importes firmados', () => {
    const pdf = prepareContributionsByPersonPdf('Cafés Semanal', report, '10/08/2026 12:00')
    if (pdf === null) throw new Error('El PDF de prueba debe existir.')
    const pages = createStyledPdfPages(pdf).join('\n')

    expect(pages).toContain('Aportaciones por persona')
    expect(pages).toContain('Persona inactiva con historial')
    expect(pages).toContain('683,00 €')
    expect(pages).toContain('-1,00 €')
    expect(createStyledPdfDocument(pdf).type).toBe('application/pdf')
  })

  it('no prepara PDF para un resultado sin movimientos incluidos', () => {
    expect(prepareContributionsByPersonPdf('Vacío', { ...report, includedContributionCount: 0 }, '10/08/2026')).toBeNull()
  })
})
