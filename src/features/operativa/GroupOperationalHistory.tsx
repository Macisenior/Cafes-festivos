import { useEffect, useState } from 'react'
import type { Contribution, Expense, GroupId, Person } from '../../domain/entities'
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

interface GroupOperationalHistoryProps {
  groupId: GroupId
  people: readonly Person[]
  contributions: readonly Contribution[]
  expenses: readonly Expense[]
  title?: string
  eyebrow?: string
  groupName?: string
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
  groupId,
  people,
  contributions,
  expenses,
  title = 'Historial operativo',
  eyebrow = 'Consulta',
  groupName,
  emptyMessage = 'Todavía no hay movimientos en este grupo.',
  enableFilters = false,
  defaultToCurrentMonth = false,
}: GroupOperationalHistoryProps) {
  const entries = createOperationalHistory(groupId, people, contributions, expenses)
  const initialFilters = () => defaultToCurrentMonth ? currentMonthHistoricalFilters() : EMPTY_HISTORICAL_FILTERS
  const [filters, setFilters] = useState<HistoricalFilters>(initialFilters)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    setFilters(initialFilters())
    setPdfError(null)
  }, [groupId])

  const filteredEntries = enableFilters ? filterOperationalHistory(entries, filters) : entries
  const peopleWithHistory = people.filter((person) => person.groupId === groupId && entries.some((entry) => (
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
    const report = prepareHistoricalPdfReport(groupName ?? groupId, filteredEntries, filters, people, generatedOn)
    if (report === null) {
      setPdfError('No hay movimientos para exportar con los filtros actuales.')
      return
    }
    setPdfError(null)
    downloadHistoricalPdf(report, historicalPdfFilename(groupName ?? groupId, filters))
  }

  return (
    <section className="operational-history" aria-labelledby="operational-history-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="operational-history-title">{title}</h2>
          {groupName && <p className="history-group-name">Grupo: {groupName}</p>}
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
