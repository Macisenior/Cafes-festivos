import { describe, expect, it } from 'vitest'
import { createStyledPdfDocument, createStyledPdfPages } from './historical-pdf'
import type { MonthlyContributionsReport } from './monthly-contributions'
import { prepareMonthlyContributionsPdf } from './monthly-contributions-pdf'

const report: MonthlyContributionsReport = {
  groupId: 'general', range: { fromMonth: '2025-01', toMonth: '2025-02' }, totalInRangeInCents: 4000,
  months: [
    { month: '2025-01', totalInCents: 4000, contributionCount: 3, people: [
      { personId: 'ana', personName: 'Ana', isActive: true, contributedInCents: 1500 },
      { personId: 'pepe', personName: 'Pepe', isActive: false, contributedInCents: 2500 },
    ] },
    { month: '2025-02', totalInCents: 0, contributionCount: 0, people: [] },
  ],
  inheritedOpeningTotalInCents: 3000,
  inheritedOpeningByPerson: [{ personId: 'ana', personName: 'Ana', isActive: true, contributedInCents: 3000 }],
}

describe('PDF de aportaciones mensuales', () => {
  it('prepara el resumen con una fila por mes y aperturas fuera del período', () => {
    const pdf = prepareMonthlyContributionsPdf('Cafés', report, '16/11/2026', 'summary')
    expect(pdf.rows.map((row) => [row.title, row.amountInCents])).toEqual([['Enero de 2025', 4000], ['Febrero de 2025', 0]])
    expect(pdf.filters.join(' ')).toContain('no incluidas en los meses')
    expect(pdf.summary.at(-1)?.amountInCents).toBe(4000)
  })

  it('prepara detalle por persona, inactivas y aperturas separadas', () => {
    const pdf = prepareMonthlyContributionsPdf('Cafés', report, '16/11/2026', 'detailed')
    const rendered = createStyledPdfPages(pdf).join('\n')
    expect(rendered).toContain('Aportaciones mensuales - detalle')
    expect(rendered).toContain('- Pepe')
    expect(rendered).toContain('Persona inactiva - historial conservado')
    expect(rendered).toContain('APERTURAS HEREDADAS SIN FECHA')
    expect(rendered).toContain('TOTAL MESES SELECCIONADOS')
    expect(createStyledPdfDocument(pdf).type).toBe('application/pdf')
  })

  it('pagina muchos meses manteniendo una cabecera mensual con su primera persona', () => {
    const manyMonths = Array.from({ length: 40 }, (_, index) => ({ ...report.months[0], month: `${2023 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}` }))
    const pdf = prepareMonthlyContributionsPdf('Cafés', { ...report, months: manyMonths }, '16/11/2026', 'detailed')
    const pages = createStyledPdfPages(pdf)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every((page) => !page.trimStart().startsWith('- Ana'))).toBe(true)
    expect(pages.at(-1)).toContain('RESUMEN FINAL')
  })
})
