import type { StyledPdfReport } from './historical-pdf'
import type { ExpensesByPersonReport } from './expenses-by-person'

/** Adapta el resultado ya preparado para pantalla a la plantilla PDF V4, sin recalcularlo. */
export function prepareExpensesByPersonPdf(
  groupName: string,
  report: ExpensesByPersonReport,
  generatedOn: string,
): StyledPdfReport | null {
  if (report.people.length === 0 || report.totalExpensesInCents === 0) return null
  const filters: string[] = []
  if (report.range.from !== '') filters.push(`Desde: ${report.range.from.split('-').reverse().join('/')}`)
  if (report.range.to !== '') filters.push(`Hasta: ${report.range.to.split('-').reverse().join('/')}`)
  if (filters.length === 0) filters.push('Rango: Todo el histórico')

  return {
    title: 'Gastos por persona',
    sectionTitle: 'PERSONAS',
    groupName,
    generatedOn,
    filters,
    rows: report.people.map((person) => ({
      title: person.personName,
      detail: person.isActive ? undefined : 'Persona inactiva con historial',
      amountInCents: person.spentInCents,
      tone: 'negative' as const,
    })),
    summary: [{ label: 'TOTAL GENERAL', amountInCents: report.totalExpensesInCents, tone: 'negative' }],
  }
}
