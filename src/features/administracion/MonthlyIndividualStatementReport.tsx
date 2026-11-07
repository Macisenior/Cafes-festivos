import { useMemo, useState } from 'react'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { formatPdfMoney } from './historical-pdf'
import { createMonthlyIndividualStatement, type MonthlyIndividualStatement } from './monthly-individual-statement'
import { downloadMonthlyIndividualPdf, monthlyIndividualPdfFilename, type MonthlyIndividualPdfReport } from './monthly-individual-statement-pdf'
import { shareMonthlyIndividualPdf } from './monthly-individual-statement-share'

interface Props { group: Group; people: readonly Person[]; contributions: readonly Contribution[]; expenses: readonly Expense[] }
function currentMonthInMadrid(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}`
}
function generatedOn(): string { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date()) }

export function MonthlyIndividualStatementReport({ group, people, contributions, expenses }: Props) {
  const groupPeople = useMemo(() => people.filter((person) => person.groupId === group.id), [group.id, people])
  const [personId, setPersonId] = useState(groupPeople[0]?.id ?? '')
  const [month, setMonth] = useState(currentMonthInMadrid)
  const [message, setMessage] = useState<string | null>(null)
  const selectedPersonId = groupPeople.some((person) => person.id === personId) ? personId : groupPeople[0]?.id ?? ''

  let report: MonthlyIndividualStatement | null = null
  let error: string | null = null
  try { if (selectedPersonId !== '') report = createMonthlyIndividualStatement(group, people, contributions, expenses, selectedPersonId, month) } catch (reason) { error = reason instanceof Error ? reason.message : 'No se pudo preparar el extracto mensual.' }
  function pdfReport(): MonthlyIndividualPdfReport | null { return report === null ? null : { ...report, groupName: group.name, generatedOn: generatedOn() } }
  function downloadPdf() {
    const pdf = pdfReport()
    if (pdf === null) return
    downloadMonthlyIndividualPdf(pdf, monthlyIndividualPdfFilename(pdf.personName, pdf.month))
    setMessage('PDF generado y descargado.')
  }
  async function sharePdf() {
    const pdf = pdfReport()
    if (pdf === null) return
    try {
      const result = await shareMonthlyIndividualPdf(pdf, monthlyIndividualPdfFilename(pdf.personName, pdf.month))
      if (result === 'shared') setMessage('Hoja de compartir abierta. Elige WhatsApp para enviarlo manualmente.')
      else if (result === 'unsupported') setMessage('Este navegador no permite compartir archivos. Descarga el PDF y adjúntalo manualmente en WhatsApp.')
      else setMessage(null)
    } catch { setMessage('No se pudo abrir la hoja de compartir. Descarga el PDF y adjúntalo manualmente en WhatsApp.') }
  }

  return (
    <section className="operational-history" aria-labelledby="monthly-individual-title">
      <div className="section-heading"><div><p className="eyebrow">Administración</p><h2 id="monthly-individual-title">Extractos mensuales</h2><p className="history-group-name">Grupo: {group.name}</p></div></div>
      <div className="history-filters" aria-label="Selección del extracto mensual">
        <label>Persona<select value={selectedPersonId} onChange={(event) => { setPersonId(event.target.value); setMessage(null) }} disabled={groupPeople.length === 0}>{groupPeople.map((person) => <option key={person.id} value={person.id}>{person.name}{person.isActive ? '' : ' (inactiva)'}</option>)}</select></label>
        <label>Mes<input type="month" value={month} onChange={(event) => { if (event.target.value !== '') setMonth(event.target.value); setMessage(null) }} required /></label>
        <button type="button" disabled={report === null} onClick={downloadPdf}>📄 Generar y descargar PDF</button>
        <button type="button" disabled={report === null} onClick={() => void sharePdf()}>📤 Compartir PDF</button>
      </div>
      {groupPeople.length === 0 && <p className="history-empty-state">Este grupo no tiene personas disponibles.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {report && <div className="monthly-statement-preview" aria-label="Resumen del extracto seleccionado">
        <div className="expense-report-total"><strong>SALDO INICIAL</strong><strong className={report.openingBalanceInCents > 0 ? 'positive' : report.openingBalanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(report.openingBalanceInCents)}</strong></div>
        <p>{report.movements.length === 0 ? 'El mes seleccionado no tiene movimientos. El PDF mostrará igualmente los saldos inicial y final.' : `${report.movements.length} movimientos incluidos en orden cronológico.`}</p>
        <div className="expense-report-total"><strong>SALDO FINAL</strong><strong className={report.closingBalanceInCents > 0 ? 'positive' : report.closingBalanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(report.closingBalanceInCents)}</strong></div>
      </div>}
      {message && <p className="form-success" role="status">{message}</p>}
    </section>
  )
}
