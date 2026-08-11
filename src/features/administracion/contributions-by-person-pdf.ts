import type { StyledPdfReport } from './historical-pdf'
import type { ContributionsByPersonReport } from './contributions-by-person'

/** Adapta el resultado visible de aportaciones a la plantilla PDF V4 sin recalcular importes. */
export function prepareContributionsByPersonPdf(
  groupName: string,
  report: ContributionsByPersonReport,
  generatedOn: string,
): StyledPdfReport | null {
  if (report.includedContributionCount === 0) return null
  const filters: string[] = []
  if (report.range.from !== '') filters.push(`Desde: ${report.range.from.split('-').reverse().join('/')}`)
  if (report.range.to !== '') filters.push(`Hasta: ${report.range.to.split('-').reverse().join('/')}`)
  if (filters.length === 0) filters.push('Rango: Todo el histórico (incluye aperturas sin fecha)')

  return {
    title: 'Aportaciones por persona',
    sectionTitle: 'PERSONAS',
    groupName,
    generatedOn,
    filters,
    rows: report.people.map((person) => ({
      title: person.personName,
      detail: person.isActive ? undefined : 'Persona inactiva con historial',
      amountInCents: person.contributedInCents,
      tone: person.contributedInCents < 0 ? 'negative' as const : 'positive' as const,
    })),
    summary: [{ label: 'TOTAL APORTACIONES', amountInCents: report.totalContributionsInCents, tone: report.totalContributionsInCents < 0 ? 'negative' : 'positive' }],
  }
}
