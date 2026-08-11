import { describe, expect, it } from 'vitest'
import type { OperationalHistoryEntry } from './operational-history'
import { currentMonthHistoricalFilters, EMPTY_HISTORICAL_FILTERS, filterOperationalHistory } from './operational-history-filters'

const entries: readonly OperationalHistoryEntry[] = [
  { id: 'expense-late', kind: 'expense', date: '2026-08-10', concept: 'Cena', siteName: 'Flap', amountInCents: 1200, participantsCount: 1, participantIds: ['bea'], allocations: [{ personId: 'bea', amountInCents: 1200 }], distributionMode: 'igual' },
  { id: 'contribution-bea', kind: 'contribution', date: '2026-08-08', personId: 'bea', personName: 'Bea', amountInCents: 2000, isInheritedOpening: false },
  { id: 'expense-shared', kind: 'expense', date: '2026-08-05', concept: 'Cafés', siteName: 'Lydo', amountInCents: 500, participantsCount: 2, participantIds: ['ana', 'bea'], allocations: [{ personId: 'ana', amountInCents: 200 }, { personId: 'bea', amountInCents: 300 }], distributionMode: 'igual' },
  { id: 'contribution-ana', kind: 'contribution', date: '2026-08-01', personId: 'ana', personName: 'Ana', amountInCents: 1000, isInheritedOpening: false },
  { id: 'opening-ana', kind: 'contribution', date: null, personId: 'ana', personName: 'Ana', amountInCents: 300, isInheritedOpening: true },
]

describe('filtros del histórico operativo', () => {
  it('filtra desde una fecha manteniendo el orden cronológico descendente', () => {
    expect(filterOperationalHistory(entries, { ...EMPTY_HISTORICAL_FILTERS, from: '2026-08-05' }).map((entry) => entry.id))
      .toEqual(['expense-late', 'contribution-bea', 'expense-shared'])
  })

  it('filtra hasta una fecha de forma inclusiva', () => {
    expect(filterOperationalHistory(entries, { ...EMPTY_HISTORICAL_FILTERS, to: '2026-08-05' }).map((entry) => entry.id))
      .toEqual(['expense-shared', 'contribution-ana'])
  })

  it('incluye ambos extremos de un rango de fechas', () => {
    expect(filterOperationalHistory(entries, { ...EMPTY_HISTORICAL_FILTERS, from: '2026-08-05', to: '2026-08-08' }).map((entry) => entry.id))
      .toEqual(['contribution-bea', 'expense-shared'])
  })

  it('muestra aportaciones y gastos en los que participa la persona elegida', () => {
    expect(filterOperationalHistory(entries, { ...EMPTY_HISTORICAL_FILTERS, personId: 'ana' }).map((entry) => entry.id))
      .toEqual(['expense-shared', 'contribution-ana', 'opening-ana'])
  })

  it('permite consultar el historial de una persona actualmente inactiva', () => {
    const inactiveAnaEntries = filterOperationalHistory(entries, { ...EMPTY_HISTORICAL_FILTERS, personId: 'ana' })

    expect(inactiveAnaEntries).toHaveLength(3)
    expect(inactiveAnaEntries.some((entry) => entry.kind === 'expense' && entry.participantIds.includes('ana'))).toBe(true)
  })

  it('filtra por aportaciones o gastos', () => {
    expect(filterOperationalHistory(entries, { ...EMPTY_HISTORICAL_FILTERS, movementType: 'contribution' }).every((entry) => entry.kind === 'contribution')).toBe(true)
    expect(filterOperationalHistory(entries, { ...EMPTY_HISTORICAL_FILTERS, movementType: 'expense' }).map((entry) => entry.id))
      .toEqual(['expense-late', 'expense-shared'])
  })

  it('combina persona, tipo y rango de fechas', () => {
    expect(filterOperationalHistory(entries, {
      from: '2026-08-01',
      to: '2026-08-05',
      personId: 'ana',
      movementType: 'expense',
    }).map((entry) => entry.id)).toEqual(['expense-shared'])
  })

  it('permite limpiar filtros usando el estado vacío compartido', () => {
    expect(filterOperationalHistory(entries, EMPTY_HISTORICAL_FILTERS)).toEqual(entries)
  })

  it('devuelve cero resultados cuando ningún movimiento coincide', () => {
    expect(filterOperationalHistory(entries, { ...EMPTY_HISTORICAL_FILTERS, from: '2026-09-01' })).toEqual([])
  })

  it('no mezcla entradas de otro grupo cuando recibe el histórico ya aislado del grupo activo', () => {
    const otherGroupEntries = entries.filter((entry) => entry.id === 'expense-late')

    expect(filterOperationalHistory(otherGroupEntries, EMPTY_HISTORICAL_FILTERS).map((entry) => entry.id)).toEqual(['expense-late'])
  })

  it('crea por defecto el mes actual completo, con límites inclusivos', () => {
    const filters = currentMonthHistoricalFilters(new Date('2026-08-10T12:00:00Z'))
    const monthEntries: readonly OperationalHistoryEntry[] = [
      { ...entries[0], id: 'august-last', date: '2026-08-31' },
      { ...entries[0], id: 'july-last', date: '2026-07-31' },
      { ...entries[0], id: 'september-first', date: '2026-09-01' },
    ]

    expect(filters).toMatchObject({ from: '2026-08-01', to: '2026-08-31', personId: '', movementType: 'all' })
    expect(filterOperationalHistory(monthEntries, filters).map((entry) => entry.id)).toEqual(['august-last'])
  })

  it('combina el mes actual con Persona y Tipo sin cambiar el orden visible', () => {
    const filters = { ...currentMonthHistoricalFilters(new Date('2026-08-10T12:00:00Z')), personId: 'ana', movementType: 'expense' as const }

    expect(filterOperationalHistory(entries, filters).map((entry) => entry.id)).toEqual(['expense-shared'])
  })
})
