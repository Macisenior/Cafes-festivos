import { useMemo, useState } from 'react'
import type { Contribution, Group, Person } from '../../domain/entities'
import { formatPdfMoney } from './historical-pdf'
import { createMonthlyContributionsReport, earliestDatedContributionMonth, type MonthlyContributionRange, type MonthlyContributionsReport } from './monthly-contributions'
import { createMonthlyContributionsPdfDocument, prepareMonthlyContributionsPdf, type MonthlyContributionsPdfMode } from './monthly-contributions-pdf'
import { shareMonthlyContributionsPdf } from './monthly-contributions-share'

interface Props { group: Group; people: readonly Person[]; contributions: readonly Contribution[] }

function currentMonthInMadrid(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}`
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const value = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function MonthlyContributionsView({ group, people, contributions }: Props) {
  const todayMonth = currentMonthInMadrid()
  const [range, setRange] = useState<MonthlyContributionRange>({ fromMonth: `${todayMonth.slice(0, 4)}-01`, toMonth: todayMonth })
  const [pdfMessage, setPdfMessage] = useState<string | null>(null)
  const earliestMonth = useMemo(() => earliestDatedContributionMonth(group.id, contributions, todayMonth), [contributions, group.id, todayMonth])
  let report: MonthlyContributionsReport | null = null
  let rangeError: string | null = null
  try { report = createMonthlyContributionsReport(group.id, people, contributions, range) } catch (reason) { rangeError = reason instanceof Error ? reason.message : 'El rango mensual no es válido.' }

  function setShortcut(kind: 'year' | 'last12' | 'all') {
    if (kind === 'year') setRange({ fromMonth: `${todayMonth.slice(0, 4)}-01`, toMonth: todayMonth })
    else if (kind === 'last12') setRange({ fromMonth: shiftMonth(todayMonth, -11), toMonth: todayMonth })
    else setRange({ fromMonth: earliestMonth, toMonth: todayMonth })
    setPdfMessage(null)
  }

  function exportPdf(mode: MonthlyContributionsPdfMode) {
    if (report === null) return
    const generatedOn = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date())
    const pdf = prepareMonthlyContributionsPdf(group.name, report, generatedOn, mode)
    const url = URL.createObjectURL(createMonthlyContributionsPdfDocument(pdf))
    const link = document.createElement('a')
    link.href = url
    link.download = pdfFilename(mode)
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setPdfMessage(`PDF ${mode === 'summary' ? 'resumido' : 'detallado'} generado.`)
  }

  function pdfFilename(mode: MonthlyContributionsPdfMode): string {
    return `aportaciones-mensuales-${mode}-${group.id}-${range.fromMonth}-${range.toMonth}.pdf`
  }

  async function sharePdf(mode: MonthlyContributionsPdfMode) {
    if (report === null) return
    const generatedOn = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date())
    const pdf = prepareMonthlyContributionsPdf(group.name, report, generatedOn, mode)
    try {
      const result = await shareMonthlyContributionsPdf(pdf, pdfFilename(mode), `Aportaciones mensuales - ${mode === 'summary' ? 'resumen' : 'detalle'}`)
      if (result === 'shared') setPdfMessage('Hoja de compartir abierta. Elige WhatsApp y el destinatario manualmente.')
      else if (result === 'unsupported') setPdfMessage('Este navegador no permite compartir archivos. Usa el botón de descarga y adjunta el PDF manualmente en WhatsApp.')
      else setPdfMessage(null)
    } catch {
      setPdfMessage('No se pudo abrir la hoja de compartir. Descarga el PDF y adjúntalo manualmente en WhatsApp.')
    }
  }

  return <div className="monthly-contributions-view">
    <div className="history-filters" aria-label="Rango de aportaciones mensuales">
      <label>Desde mes<input type="month" value={range.fromMonth} onChange={(event) => { if (event.target.value !== '') setRange((current) => ({ ...current, fromMonth: event.target.value })); setPdfMessage(null) }} /></label>
      <label>Hasta mes<input type="month" value={range.toMonth} onChange={(event) => { if (event.target.value !== '') setRange((current) => ({ ...current, toMonth: event.target.value })); setPdfMessage(null) }} /></label>
      <button type="button" onClick={() => setShortcut('year')}>Año actual</button>
      <button type="button" onClick={() => setShortcut('last12')}>Últimos 12 meses</button>
      <button type="button" onClick={() => setShortcut('all')}>Todo el histórico fechado</button>
    </div>
    {rangeError && <p className="form-error" role="alert">{rangeError}</p>}
    {report && <>
      <section className="inherited-openings" aria-labelledby="inherited-openings-title">
        <div><strong id="inherited-openings-title">Aperturas heredadas sin fecha</strong><span>No se asignan ni se suman a ningún mes.</span></div>
        <strong>{formatPdfMoney(report.inheritedOpeningTotalInCents)}</strong>
        {report.inheritedOpeningByPerson.length > 0 && <details><summary>Ver desglose de aperturas</summary><ul>{report.inheritedOpeningByPerson.map((person) => <li key={person.personId}><span>{person.personName}{person.isActive ? '' : ' · Inactiva'}</span><strong>{formatPdfMoney(person.contributedInCents)}</strong></li>)}</ul></details>}
      </section>
      <div className="monthly-contribution-list">
        {report.months.map((month) => <details className="monthly-contribution-card" key={month.month}>
          <summary><span><strong>{monthLabel(month.month)}</strong><small>{month.contributionCount === 0 ? 'Sin aportaciones' : `${month.contributionCount} movimientos`}</small></span><strong className={month.totalInCents < 0 ? 'negative' : month.totalInCents > 0 ? 'positive' : ''}>{formatPdfMoney(month.totalInCents)}</strong></summary>
          {month.people.length === 0 ? <p>No hubo aportaciones fechadas durante este mes.</p> : <ul>{month.people.map((person) => <li key={person.personId}><span>{person.personName}{person.isActive ? '' : ' · Inactiva'}</span><strong className={person.contributedInCents < 0 ? 'negative' : 'positive'}>{formatPdfMoney(person.contributedInCents)}</strong></li>)}</ul>}
        </details>)}
      </div>
      <div className="expense-report-total"><strong>TOTAL MESES SELECCIONADOS</strong><strong className={report.totalInRangeInCents < 0 ? 'negative' : report.totalInRangeInCents > 0 ? 'positive' : ''}>{formatPdfMoney(report.totalInRangeInCents)}</strong></div>
      <div className="monthly-pdf-groups">
        <section><strong>PDF resumido</strong><div className="monthly-pdf-actions"><button type="button" onClick={() => exportPdf('summary')}>📥 Descargar</button><button type="button" onClick={() => void sharePdf('summary')}>📤 Compartir PDF</button></div></section>
        <section><strong>PDF detallado</strong><div className="monthly-pdf-actions"><button type="button" onClick={() => exportPdf('detailed')}>📥 Descargar</button><button type="button" onClick={() => void sharePdf('detailed')}>📤 Compartir PDF</button></div></section>
      </div>
      {pdfMessage && <p className="form-success" role="status">{pdfMessage}</p>}
    </>}
  </div>
}
