import { useEffect, useState } from 'react'
import type { Contribution, Group, Person } from '../../domain/entities'
import { createContributionsByPersonReport, EMPTY_CONTRIBUTIONS_BY_PERSON_RANGE, type ContributionByPersonDateRange } from './contributions-by-person'
import { createStyledPdfDocument, formatPdfMoney, historicalPdfFilename } from './historical-pdf'
import { prepareContributionsByPersonPdf } from './contributions-by-person-pdf'

interface ContributionsByPersonReportProps {
  group: Group
  people: readonly Person[]
  contributions: readonly Contribution[]
}

export function ContributionsByPersonReport({ group, people, contributions }: ContributionsByPersonReportProps) {
  const [range, setRange] = useState<ContributionByPersonDateRange>(EMPTY_CONTRIBUTIONS_BY_PERSON_RANGE)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const report = createContributionsByPersonReport(group.id, people, contributions, range)

  useEffect(() => {
    setRange(EMPTY_CONTRIBUTIONS_BY_PERSON_RANGE)
    setPdfError(null)
  }, [group.id])

  function exportPdf() {
    const generatedOn = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date())
    const pdf = prepareContributionsByPersonPdf(group.name, report, generatedOn)
    if (pdf === null) {
      setPdfError('No hay aportaciones para exportar en el rango seleccionado.')
      return
    }
    setPdfError(null)
    const url = URL.createObjectURL(createStyledPdfDocument(pdf))
    const link = document.createElement('a')
    link.href = url
    link.download = historicalPdfFilename(`aportaciones-por-persona-${group.name}`, { ...range, personId: '', movementType: 'contribution' })
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const hasIncludedContributions = report.includedContributionCount > 0

  return (
    <section className="operational-history" aria-labelledby="contributions-by-person-title">
      <div className="section-heading"><div><p className="eyebrow">Informes</p><h2 id="contributions-by-person-title">Aportaciones por persona</h2><p className="history-group-name">Grupo: {group.name}</p></div></div>
      <div className="history-filters" aria-label="Rango de aportaciones por persona">
        <label>Desde<input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label>
        <label>Hasta<input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label>
        <button type="button" onClick={() => setRange(EMPTY_CONTRIBUTIONS_BY_PERSON_RANGE)}>Limpiar rango</button>
        <button type="button" onClick={exportPdf}>📄 Exportar PDF</button>
      </div>
      {!hasIncludedContributions ? <p className="history-empty-state">No hay aportaciones en el rango seleccionado.</p> : <ul className="history-list">
        {report.people.map((person) => <li key={person.personId}><div><strong>{person.personName}</strong>{!person.isActive && <span>Inactiva · historial conservado</span>}</div><strong className={person.contributedInCents < 0 ? 'negative' : 'positive'}>{formatPdfMoney(person.contributedInCents)}</strong></li>)}
      </ul>}
      {hasIncludedContributions && <div className="expense-report-total"><strong>TOTAL APORTACIONES</strong><strong>{formatPdfMoney(report.totalContributionsInCents)}</strong></div>}
      {pdfError && <p className="form-error" role="alert">{pdfError}</p>}
    </section>
  )
}
