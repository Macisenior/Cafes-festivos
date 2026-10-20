import { useEffect, useState } from 'react'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { createOperationalHistory } from './operational-history'
import {
  EMPTY_HISTORICAL_FILTERS,
  currentMonthHistoricalFilters,
  filterOperationalHistory,
  type HistoricalFilters,
} from './operational-history-filters'
import {
  downloadHistoricalPdf,
  historicalPdfFilename,
  prepareHistoricalPdfReport,
} from '../administracion/historical-pdf'
import { shareHistoricalPdf } from '../administracion/historical-pdf-share'
import { createHistoricalPeriodSummary } from '../administracion/historical-period-summary'

interface GroupOperationalHistoryProps {
  group: Group
  people: readonly Person[]
  contributions: readonly Contribution[]
  expenses: readonly Expense[]
  title?: string
  eyebrow?: string
  emptyMessage?: string
  enableFilters?: boolean
  defaultToCurrentMonth?: boolean
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amountInCents / 100)
}

function formatDate(date: string | null): string {
  if (date === null) return 'Sin fecha histórica'
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

const modeLabel = { igual: 'Igual', consumiciones: 'Consumiciones', importe: 'Importe por persona' }

export function GroupOperationalHistory({
  group,
  people,
  contributions,
  expenses,
  title = 'Historial operativo',
  eyebrow = 'Consulta',
  emptyMessage = 'Todavía no hay movimientos en este grupo.',
  enableFilters = false,
  defaultToCurrentMonth = false,
}: GroupOperationalHistoryProps) {
  const entries = createOperationalHistory(group.id, people, contributions, expenses)
  const initialFilters = () => defaultToCurrentMonth ? currentMonthHistoricalFilters() : EMPTY_HISTORICAL_FILTERS
  const [filters, setFilters] = useState<HistoricalFilters>(initialFilters)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [isSharingPdf, setIsSharingPdf] = useState(false)

  useEffect(() => {
    setFilters(initialFilters())
    setPdfError(null)
    setIsSharingPdf(false)
  }, [group.id])

  const filteredEntries = enableFilters ? filterOperationalHistory(entries, filters) : entries
  const peopleWithHistory = people.filter((person) => person.groupId === group.id && entries.some((entry) => (
    entry.kind === 'contribution' ? entry.personId === person.id : entry.participantIds.includes(person.id)
  )))

  function updateFilter<Key extends keyof HistoricalFilters>(key: Key, value: HistoricalFilters[Key]) {
    setFilters((current) => {
      if (defaultToCurrentMonth && (key === 'from' || key === 'to')) {
        const month = currentMonthHistoricalFilters()
        const replacingInitialMonth = current.from === month.from && current.to === month.to
        if (replacingInitialMonth && value !== month[key]) {
          return { ...current, [key]: value, [key === 'from' ? 'to' : 'from']: '' }
        }
      }
      return { ...current, [key]: value }
    })
  }

  const initialMonth = defaultToCurrentMonth ? currentMonthHistoricalFilters() : null
  const isShowingCurrentMonth = initialMonth !== null && filters.from === initialMonth.from && filters.to === initialMonth.to

  function exportPdf() {
    const generatedOn = new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Madrid',
    }).format(new Date())
    const periodSummary = createHistoricalPeriodSummary(group, people, contributions, expenses, filters)
    const report = prepareHistoricalPdfReport(group.name, filteredEntries, filters, people, generatedOn, periodSummary ?? undefined)
    if (report === null) {
      setPdfError('No hay movimientos para exportar con los filtros actuales.')
      return
    }
    setPdfError(null)
    downloadHistoricalPdf(report, historicalPdfFilename(group.name, filters))
  }

  async function sharePdf() {
    if (isSharingPdf) return
    const generatedOn = new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Madrid',
    }).format(new Date())
    const periodSummary = createHistoricalPeriodSummary(group, people, contributions, expenses, filters)
    const report = prepareHistoricalPdfReport(group.name, filteredEntries, filters, people, generatedOn, periodSummary ?? undefined)
    if (report === null) {
      setPdfError('No hay movimientos para compartir con los filtros actuales.')
      return
    }

    setPdfError(null)
    setIsSharingPdf(true)
    try {
      const result = await shareHistoricalPdf(
        report,
        historicalPdfFilename(group.name, filters),
        `Histórico · ${group.name}`,
      )
      if (result === 'unsupported') setPdfError('Este dispositivo no permite compartir el PDF como archivo. Puedes usar «Exportar PDF».')
    } catch (reason) {
      setPdfError(reason instanceof Error ? `No se ha podido compartir el PDF: ${reason.message}` : 'No se ha podido compartir el PDF.')
    } finally {
      setIsSharingPdf(false)
    }
  }

  return (
    <section className="operational-history" aria-labelledby="operational-history-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="operational-history-title">{title}</h2>
          <p className="history-group-name">Grupo: {group.name}</p>
        </div>
        <span className="people-count">{filteredEntries.length} movimientos</span>
      </div>
      {enableFilters && <div className="history-filters" aria-label="Filtros de históricos">
        {isShowingCurrentMonth && <p className="history-current-month">Mostrando el mes actual: {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(new Date())}.</p>}
        <label>Desde<input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} /></label>
        <label>Hasta<input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} /></label>
        <label>Persona<select value={filters.personId} onChange={(event) => updateFilter('personId', event.target.value)}><option value="">Todas</option>{peopleWithHistory.map((person) => <option key={person.id} value={person.id}>{person.name}{person.isActive ? '' : ' (Inactiva)'}</option>)}</select></label>
        <label>Tipo de movimiento<select value={filters.movementType} onChange={(event) => updateFilter('movementType', event.target.value as HistoricalFilters['movementType'])}><option value="all">Todos</option><option value="contribution">Aportaciones</option><option value="expense">Gastos</option></select></label>
        {defaultToCurrentMonth && !isShowingCurrentMonth && <button type="button" onClick={() => setFilters(currentMonthHistoricalFilters())}>Ver mes actual</button>}
        {defaultToCurrentMonth && (filters.from !== '' || filters.to !== '') && <button type="button" onClick={() => setFilters((current) => ({ ...current, from: '', to: '' }))}>Ver todo el histórico</button>}
        <button type="button" onClick={() => setFilters(initialFilters())}>Limpiar filtros</button>
        <button type="button" onClick={exportPdf}>📄 Exportar PDF</button>
        <button type="button" disabled={isSharingPdf} onClick={() => void sharePdf()}>{isSharingPdf ? 'Compartiendo…' : 'Compartir PDF'}</button>
      </div>}
      {filteredEntries.length === 0 ? <p className="history-empty-state">{entries.length === 0 ? emptyMessage : 'No hay movimientos que coincidan con los filtros.'}</p> : <ul className="history-list">
        {filteredEntries.map((entry) => (
          <li key={`${entry.kind}:${entry.id}`}>
            {entry.kind === 'contribution' ? (
              <>
                <div>
                  <strong>{entry.isInheritedOpening ? 'Aportación de apertura heredada' : 'Aportación'}</strong>
                  <span>{entry.personName} · {formatDate(entry.date)}</span>
                </div>
                <strong className="positive">{formatCurrency(entry.amountInCents)}</strong>
              </>
            ) : (
              <>
                <div>
                  <strong>Gasto</strong>
                  <span>{formatDate(entry.date)} · {entry.siteName} · {entry.concept} · {entry.participantsCount} participantes · {modeLabel[entry.distributionMode]}</span>
                </div>
                <strong className="negative">−{formatCurrency(entry.amountInCents)}</strong>
              </>
            )}
          </li>
        ))}
      </ul>}
      {pdfError && <p className="form-error" role="alert">{pdfError}</p>}
    </section>
  )
}
