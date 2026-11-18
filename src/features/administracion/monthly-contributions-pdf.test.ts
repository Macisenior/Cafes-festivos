import { describe, expect, it } from 'vitest'
import type { MonthlyContributionsReport } from './monthly-contributions'
import { createMonthlyContributionsPdfDocument, createMonthlyContributionsPdfPages, prepareMonthlyContributionsPdf } from './monthly-contributions-pdf'

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
  it('muestra los meses, incluidos los vacíos, y una sola vez las aperturas fuera del período', async () => {
    const pdf = prepareMonthlyContributionsPdf('Cafés', report, '16/11/2026', 'summary')
    const rendered = createMonthlyContributionsPdfPages(pdf).join('\n')
    expect(rendered).toContain('(Enero de 2025)')
    expect(rendered).toContain('(Febrero de 2025)')
    expect(rendered).toContain('(0,00 €)')
    expect(rendered).toContain('(Fuera del período)')
    expect(rendered.match(/\(Aperturas sin fecha\)/g)).toHaveLength(1)
    expect(rendered).not.toContain('(Pepe)')
    expect(rendered).toContain('(Total del período)')
    const document = createMonthlyContributionsPdfDocument(pdf)
    expect(document.type).toBe('application/pdf')
    expect(await document.text()).toContain('/MediaBox [0 0 306 544]')
  })

  it('pagina el detalle con contexto y conserva nombres largos e importes negativos', () => {
    const people = [
      { personId: 'long', personName: 'María Fernanda de los Ángeles Rodríguez de la Fuente', isActive: false, contributedInCents: -123456789 },
      ...Array.from({ length: 36 }, (_, index) => ({
        personId: String(index), personName: `Persona número ${index + 1}`, isActive: true, contributedInCents: 500,
      })),
    ]
    const pdf = prepareMonthlyContributionsPdf('Cafés', {
      ...report,
      months: [{ ...report.months[0], people }],
    }, '16/11/2026', 'detailed')
    const pages = createMonthlyContributionsPdfPages(pdf)
    expect(pages.length).toBeGreaterThan(2)
    expect(pages[0]).toContain('(-1234567,89 €)')
    expect(pages[0]).toContain('María Fernanda')
    expect(pages[0]).toContain('Rodríguez de la Fuente')
    expect(pages[0]).toContain('(Persona inactiva)')
    expect(pages[1]).toContain('Enero de 2025 \\(continúa\\)')
    expect(pages.join('\n').match(/\(40,00 €/g)).toHaveLength(2)
    expect(pages.at(-1)).toContain('(Aperturas sin fecha)')
    expect(pages.at(-1)).toContain('(Total del período)')
  })
})
