import type { StyledPdfReport } from './historical-pdf'
import { formatPdfMoney } from './historical-pdf'
import type { AccountStateAtDateReport } from './account-state-at-date'

/** Adapta el informe ya calculado a la plantilla PDF V4 sin repetir cálculos. */
export function prepareAccountStateAtDatePdf(groupName: string, report: AccountStateAtDateReport, generatedOn: string): StyledPdfReport | null {
  if (report.people.length === 0) return null
  const formattedDate = report.date.split('-').reverse().join('/')
  return {
    title: 'Estado a una fecha',
    sectionTitle: 'PERSONAS',
    groupName,
    generatedOn,
    filters: [`Fecha de consulta: ${formattedDate}`, 'Aperturas heredadas sin fecha: incluidas como saldo inicial'],
    rows: report.people.map((person) => ({
      title: person.personName,
      detail: `Aportado: ${formatPdfMoney(person.contributedInCents)} · Gastado: ${formatPdfMoney(person.spentInCents)}${person.isActive ? '' : ' · Persona inactiva'}`,
      amountInCents: person.balanceInCents,
      tone: person.balanceInCents < 0 ? 'negative' as const : person.balanceInCents > 0 ? 'positive' as const : 'neutral' as const,
    })),
    summary: [
      { label: 'Total aportado', amountInCents: report.groupContributedInCents, tone: 'positive' },
      { label: 'Total gastado', amountInCents: report.groupSpentInCents, tone: 'negative' },
      { label: 'SALDO DEL GRUPO', amountInCents: report.groupBalanceInCents, tone: report.groupBalanceInCents < 0 ? 'negative' : report.groupBalanceInCents > 0 ? 'positive' : 'neutral' },
    ],
  }
}
