import type { StyledPdfReport } from './historical-pdf'
import { formatPdfDate, formatPdfMoney } from './historical-pdf'
import type { StateBetweenDatesReport } from './state-between-dates'

/** Convierte exactamente el informe visible en filas de la plantilla PDF V4. */
export function prepareStateBetweenDatesPdf(
  groupName: string,
  report: StateBetweenDatesReport,
  generatedOn: string,
): StyledPdfReport | null {
  if (report.closing.people.length === 0) return null

  return {
    title: 'Estado entre fechas',
    sectionTitle: 'EVOLUCIÓN DEL GRUPO',
    groupName,
    generatedOn,
    filters: [
      `Desde: ${formatPdfDate(report.from)}`,
      `Hasta: ${formatPdfDate(report.to)}`,
      `Saldo de apertura a ${formatPdfDate(report.openingDate)}: ${formatPdfMoney(report.openingBalanceInCents)}`,
      'Aperturas heredadas sin fecha: incluidas como saldo inicial',
    ],
    rows: report.snapshots.map((snapshot) => ({
      title: formatPdfDate(snapshot.date),
      detail: `Aportado acumulado: ${formatPdfMoney(snapshot.groupContributedInCents)} · Gastado acumulado: ${formatPdfMoney(snapshot.groupSpentInCents)}`,
      amountInCents: snapshot.groupBalanceInCents,
      tone: snapshot.groupBalanceInCents < 0 ? 'negative' as const : snapshot.groupBalanceInCents > 0 ? 'positive' as const : 'neutral' as const,
    })),
    summary: [
      { label: 'SALDO DE APERTURA', amountInCents: report.openingBalanceInCents, tone: report.openingBalanceInCents < 0 ? 'negative' : report.openingBalanceInCents > 0 ? 'positive' : 'neutral' },
      { label: 'SALDO AL CIERRE', amountInCents: report.closingBalanceInCents, tone: report.closingBalanceInCents < 0 ? 'negative' : report.closingBalanceInCents > 0 ? 'positive' : 'neutral' },
    ],
  }
}
