import type { PersonId } from '../../domain/reparto'
import type { OperationalHistoryEntry } from './operational-history'

export type HistoricalMovementType = 'all' | 'contribution' | 'expense'

export interface HistoricalFilters {
  from: string
  to: string
  personId: PersonId | ''
  movementType: HistoricalMovementType
}

export const EMPTY_HISTORICAL_FILTERS: HistoricalFilters = {
  from: '',
  to: '',
  personId: '',
  movementType: 'all',
}

/** Rango completo del mes actual en Madrid, expresado como días ISO inclusivos. */
export function currentMonthHistoricalFilters(now: Date = new Date()): HistoricalFilters {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  const year = Number(values.year)
  const month = Number(values.month)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = `${values.year}-${values.month}`

  return { ...EMPTY_HISTORICAL_FILTERS, from: `${prefix}-01`, to: `${prefix}-${String(lastDay).padStart(2, '0')}` }
}

/** Filtra una cronología ya ordenada, sin modificar sus movimientos ni su orden. */
export function filterOperationalHistory(
  entries: readonly OperationalHistoryEntry[],
  filters: HistoricalFilters,
): readonly OperationalHistoryEntry[] {
  return entries.filter((entry) => {
    if (filters.movementType !== 'all' && entry.kind !== filters.movementType) return false
    if (filters.personId !== '') {
      const belongsToPerson = entry.kind === 'contribution'
        ? entry.personId === filters.personId
        : entry.participantIds.includes(filters.personId)
      if (!belongsToPerson) return false
    }

    // Las fechas ISO YYYY-MM-DD se comparan como días, sin horas ni zonas horarias.
    if (filters.from !== '' && (entry.date === null || entry.date < filters.from)) return false
    if (filters.to !== '' && (entry.date === null || entry.date > filters.to)) return false
    return true
  })
}
