import type { StyledPdfReport, StyledPdfRow } from './historical-pdf'
import { formatPdfMoney } from './historical-pdf'
import type { MonthlyContributionsReport } from './monthly-contributions'

export type MonthlyContributionsPdfMode = 'summary' | 'detailed'

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const value = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function prepareMonthlyContributionsPdf(
  groupName: string,
  report: MonthlyContributionsReport,
  generatedOn: string,
  mode: MonthlyContributionsPdfMode,
): StyledPdfReport {
  const rows: StyledPdfRow[] = []
  report.months.forEach((month) => {
    rows.push({ title: monthLabel(month.month), detail: `${month.contributionCount} movimientos`, amountInCents: month.totalInCents, tone: month.totalInCents < 0 ? 'negative' : month.totalInCents > 0 ? 'positive' : 'neutral', keepWithNext: mode === 'detailed' && month.people.length > 0 })
    if (mode === 'detailed') month.people.forEach((person) => rows.push({ title: `- ${person.personName}`, detail: person.isActive ? 'Desglose del mes' : 'Persona inactiva - historial conservado', amountInCents: person.contributedInCents, tone: person.contributedInCents < 0 ? 'negative' : person.contributedInCents > 0 ? 'positive' : 'neutral' }))
  })
  if (mode === 'detailed' && report.inheritedOpeningByPerson.length > 0) {
    rows.push({ title: 'APERTURAS HEREDADAS SIN FECHA', detail: 'Fuera de los totales mensuales', amountInCents: report.inheritedOpeningTotalInCents, tone: 'neutral', keepWithNext: true })
    report.inheritedOpeningByPerson.forEach((person) => rows.push({ title: `- ${person.personName}`, detail: person.isActive ? 'Apertura sin fecha' : 'Persona inactiva - apertura sin fecha', amountInCents: person.contributedInCents, tone: person.contributedInCents < 0 ? 'negative' : 'positive' }))
  }
  return {
    title: mode === 'summary' ? 'Aportaciones mensuales - resumen' : 'Aportaciones mensuales - detalle',
    sectionTitle: mode === 'summary' ? 'TOTALES POR MES' : 'MESES Y PERSONAS',
    groupName,
    generatedOn,
    filters: [
      `Desde mes: ${monthLabel(report.range.fromMonth)}`,
      `Hasta mes: ${monthLabel(report.range.toMonth)}`,
      `Aperturas heredadas sin fecha: ${formatPdfMoney(report.inheritedOpeningTotalInCents)} (no incluidas en los meses)`,
    ],
    rows,
    summary: [
      { label: 'APERTURAS SIN FECHA (FUERA DEL PERÍODO)', amountInCents: report.inheritedOpeningTotalInCents, tone: 'neutral' },
      { label: 'TOTAL MESES SELECCIONADOS', amountInCents: report.totalInRangeInCents, tone: report.totalInRangeInCents < 0 ? 'negative' : report.totalInRangeInCents > 0 ? 'positive' : 'neutral' },
    ],
  }
}
