import { useEffect, useState } from 'react'
import type { Expense, Group, Person } from '../../domain/entities'
import { createExpensesByPersonReport, EMPTY_EXPENSES_BY_PERSON_RANGE, type ExpenseByPersonDateRange } from './expenses-by-person'
import { createStyledPdfDocument, formatPdfMoney, historicalPdfFilename } from './historical-pdf'
import { prepareExpensesByPersonPdf } from './expenses-by-person-pdf'

interface ExpensesByPersonReportProps {
  group: Group
  people: readonly Person[]
  expenses: readonly Expense[]
}

export function ExpensesByPersonReport({ group, people, expenses }: ExpensesByPersonReportProps) {
  const [range, setRange] = useState<ExpenseByPersonDateRange>(EMPTY_EXPENSES_BY_PERSON_RANGE)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const report = createExpensesByPersonReport(group.id, people, expenses, range)

  useEffect(() => {
    setRange(EMPTY_EXPENSES_BY_PERSON_RANGE)
    setPdfError(null)
  }, [group.id])

  function updateRange(key: keyof ExpenseByPersonDateRange, value: string) {
    setRange((current) => ({ ...current, [key]: value }))
  }

  function exportPdf() {
    const generatedOn = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date())
    const pdf = prepareExpensesByPersonPdf(group.name, report, generatedOn)
    if (pdf === null) {
      setPdfError('No hay personas ni gastos para exportar en este grupo.')
      return
    }
    setPdfError(null)
    const url = URL.createObjectURL(createStyledPdfDocument(pdf))
    const link = document.createElement('a')
    link.href = url
    link.download = historicalPdfFilename(`gastos-por-persona-${group.name}`, { ...range, personId: '', movementType: 'expense' })
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const hasIncludedExpenses = report.totalExpensesInCents > 0

  return (
    <section className="operational-history" aria-labelledby="expenses-by-person-title">
      <div className="section-heading"><div><p className="eyebrow">Informes</p><h2 id="expenses-by-person-title">Gastos por persona</h2><p className="history-group-name">Grupo: {group.name}</p></div></div>
      <div className="history-filters" aria-label="Rango de gastos por persona">
        <label>Desde<input type="date" value={range.from} onChange={(event) => updateRange('from', event.target.value)} /></label>
        <label>Hasta<input type="date" value={range.to} onChange={(event) => updateRange('to', event.target.value)} /></label>
        <button type="button" onClick={() => setRange(EMPTY_EXPENSES_BY_PERSON_RANGE)}>Limpiar rango</button>
        <button type="button" onClick={exportPdf}>📄 Exportar PDF</button>
      </div>
      {!hasIncludedExpenses ? <p className="history-empty-state">No hay gastos en el rango seleccionado.</p> : <ul className="history-list">
        {report.people.map((person) => <li key={person.personId}><div><strong>{person.personName}</strong>{!person.isActive && <span>Inactiva · historial conservado</span>}</div><strong className="negative">{formatPdfMoney(person.spentInCents)}</strong></li>)}
      </ul>}
      {hasIncludedExpenses && <div className="expense-report-total"><strong>TOTAL GENERAL</strong><strong>{formatPdfMoney(report.totalExpensesInCents)}</strong></div>}
      {pdfError && <p className="form-error" role="alert">{pdfError}</p>}
    </section>
  )
}
