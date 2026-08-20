import { useEffect, useState } from 'react'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { createAccountStateAtDateReport } from './account-state-at-date'
import { createStyledPdfDocument, historicalPdfFilename } from './historical-pdf'
import { prepareAccountStateAtDatePdf } from './account-state-at-date-pdf'
import { AccountStateAtDateResults } from './AccountStateAtDateResults'

interface AccountStateAtDateReportProps {
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

export function AccountStateAtDateReport({ group, people, contributions, expenses }: AccountStateAtDateReportProps) {
  const [date, setDate] = useState(todayInMadrid)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const report = createAccountStateAtDateReport(group, people, contributions, expenses, date)

  useEffect(() => { setDate(todayInMadrid()); setPdfError(null) }, [group.id])

  function exportPdf() {
    const generatedOn = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date())
    const pdf = prepareAccountStateAtDatePdf(group.name, report, generatedOn)
    if (pdf === null) { setPdfError('No hay personas para exportar en este grupo.'); return }
    setPdfError(null)
    const url = URL.createObjectURL(createStyledPdfDocument(pdf))
    const link = document.createElement('a')
    link.href = url
    link.download = historicalPdfFilename(`estado-${group.name}`, { from: date, to: date, personId: '', movementType: 'all' })
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <section className="operational-history" aria-labelledby="account-state-at-date-title">
      <div className="section-heading"><div><p className="eyebrow">Informes</p><h2 id="account-state-at-date-title">Estado a una fecha</h2><p className="history-group-name">Grupo: {group.name}</p></div></div>
      <div className="history-filters"><label>Fecha<input type="date" value={date} onChange={(event) => { if (event.target.value !== '') setDate(event.target.value) }} required /></label><button type="button" onClick={exportPdf}>📄 Exportar PDF</button></div>
      <AccountStateAtDateResults report={report} />
      {pdfError && <p className="form-error" role="alert">{pdfError}</p>}
    </section>
  )
}
