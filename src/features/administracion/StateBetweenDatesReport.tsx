import { useEffect, useState } from 'react'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { createStyledPdfDocument, formatPdfDate, formatPdfMoney, historicalPdfFilename } from './historical-pdf'
import { prepareStateBetweenDatesPdf } from './state-between-dates-pdf'
import { createStateBetweenDatesReport, type StateBetweenDatesReport as StateBetweenDatesReportData } from './state-between-dates'

interface StateBetweenDatesReportProps {
  group: Group
  people: readonly Person[]
  contributions: readonly Contribution[]
  expenses: readonly Expense[]
}

function todayInMadrid(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function firstDayOfCurrentMonth(): string {
  return `${todayInMadrid().slice(0, 8)}01`
}

export function StateBetweenDatesReport({ group, people, contributions, expenses }: StateBetweenDatesReportProps) {
  const [from, setFrom] = useState(firstDayOfCurrentMonth)
  const [to, setTo] = useState(todayInMadrid)
  const [pdfError, setPdfError] = useState<string | null>(null)
  let report: StateBetweenDatesReportData | null = null
  let rangeError: string | null = null

  try {
    report = createStateBetweenDatesReport(group, people, contributions, expenses, from, to)
  } catch (reason) {
    rangeError = reason instanceof Error ? reason.message : 'El rango de fechas no es válido.'
  }

  useEffect(() => {
    setFrom(firstDayOfCurrentMonth())
    setTo(todayInMadrid())
    setPdfError(null)
  }, [group.id])

  function exportPdf() {
    if (report === null) return
    const generatedOn = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date())
    const pdf = prepareStateBetweenDatesPdf(group.name, report, generatedOn)
    if (pdf === null) { setPdfError('No hay personas para exportar en este grupo.'); return }
    setPdfError(null)
    const url = URL.createObjectURL(createStyledPdfDocument(pdf))
    const link = document.createElement('a')
    link.href = url
    link.download = historicalPdfFilename(`estado-entre-fechas-${group.name}`, { from, to, personId: '', movementType: 'all' })
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <section className="operational-history" aria-labelledby="state-between-dates-title">
      <div className="section-heading"><div><p className="eyebrow">Informes</p><h2 id="state-between-dates-title">Estado entre fechas</h2><p className="history-group-name">Grupo: {group.name}</p></div></div>
      <div className="history-filters" aria-label="Rango de evolución del grupo">
        <label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
        <label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
        <button type="button" disabled={report === null} onClick={exportPdf}>📄 Exportar PDF</button>
      </div>
      {rangeError && <p className="form-error" role="alert">{rangeError}</p>}
      {report && <>
        <div className="expense-report-total"><strong>SALDO DE APERTURA</strong><strong className={report.openingBalanceInCents > 0 ? 'positive' : report.openingBalanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(report.openingBalanceInCents)}</strong></div>
        {!report.hasMovementsInRange ? <p className="history-empty-state">No hay movimientos fechados en este intervalo. Se muestra el saldo acumulado al cierre.</p> : <ul className="history-list">
          {report.snapshots.map((snapshot) => <li key={snapshot.date}><div><strong>{formatPdfDate(snapshot.date)}</strong><span>Aportado: {formatPdfMoney(snapshot.groupContributedInCents)} · Gastado: {formatPdfMoney(snapshot.groupSpentInCents)}</span><details><summary>Ver estado de cuentas</summary><ul>{snapshot.people.map((person) => <li key={person.personId}>{person.personName}{person.isActive ? '' : ' · Inactiva'}: {formatPdfMoney(person.balanceInCents)}</li>)}</ul></details></div><strong className={snapshot.groupBalanceInCents > 0 ? 'positive' : snapshot.groupBalanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(snapshot.groupBalanceInCents)}</strong></li>)}
        </ul>}
        <div className="expense-report-total"><strong>SALDO AL CIERRE</strong><strong className={report.closingBalanceInCents > 0 ? 'positive' : report.closingBalanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(report.closingBalanceInCents)}</strong></div>
      </>}
      {pdfError && <p className="form-error" role="alert">{pdfError}</p>}
    </section>
  )
}
