import type { AccountStateAtDateReport as AccountStateAtDateReportData } from './account-state-at-date'
import { formatPdfMoney } from './historical-pdf'

interface AccountStateAtDateResultsProps {
  report: AccountStateAtDateReportData
}

/** Presentación compartida del informe ya preparado; no calcula saldos. */
export function AccountStateAtDateResults({ report }: AccountStateAtDateResultsProps) {
  return <>
    {report.people.length === 0 ? <p className="history-empty-state">Este grupo no tiene personas para consultar.</p> : <ul className="history-list">
      {report.people.map((person) => <li key={person.personId}><div><strong>{person.personName}</strong><span>Aportado: {formatPdfMoney(person.contributedInCents)} · Gastado: {formatPdfMoney(person.spentInCents)}{person.isActive ? '' : ' · Inactiva'}</span></div><strong className={person.balanceInCents > 0 ? 'positive' : person.balanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(person.balanceInCents)}</strong></li>)}
    </ul>}
    <div className="expense-report-total"><strong>SALDO DEL GRUPO</strong><strong className={report.groupBalanceInCents > 0 ? 'positive' : report.groupBalanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(report.groupBalanceInCents)}</strong></div>
  </>
}
