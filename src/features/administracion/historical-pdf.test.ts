import { describe, expect, it } from 'vitest'
import type { Person } from '../../domain/entities'
import type { OperationalHistoryEntry } from '../operativa/operational-history'
import { EMPTY_HISTORICAL_FILTERS, filterOperationalHistory } from '../operativa/operational-history-filters'
import {
  createHistoricalPdfDocument,
  createHistoricalPdfPages,
  formatPdfDate,
  formatPdfMoney,
  historicalPdfFilename,
  prepareHistoricalPdfReport,
} from './historical-pdf'

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: false },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
]

const entries: readonly OperationalHistoryEntry[] = [
  { id: 'expense-late', kind: 'expense', date: '2026-08-10', concept: 'Cena', siteName: 'Flap', amountInCents: 1200, participantsCount: 1, participantIds: ['bea'], allocations: [{ personId: 'bea', amountInCents: 1200 }], distributionMode: 'igual' },
  { id: 'contribution-bea', kind: 'contribution', date: '2026-08-08', personId: 'bea', personName: 'Bea', amountInCents: 2000, isInheritedOpening: false },
  { id: 'expense-shared', kind: 'expense', date: '2026-08-05', concept: 'Cafés', siteName: 'Lydo', amountInCents: 500, participantsCount: 2, participantIds: ['ana', 'bea'], allocations: [{ personId: 'ana', amountInCents: 200 }, { personId: 'bea', amountInCents: 300 }], distributionMode: 'igual' },
  { id: 'contribution-ana', kind: 'contribution', date: '2026-08-01', personId: 'ana', personName: 'Ana', amountInCents: 1000, isInheritedOpening: false },
  { id: 'opening-ana', kind: 'contribution', date: null, personId: 'ana', personName: 'Ana', amountInCents: 300, isInheritedOpening: true },
]

function prepare(filters = EMPTY_HISTORICAL_FILTERS) {
  return prepareHistoricalPdfReport('Cafés Semanal', filterOperationalHistory(entries, filters), filters, people, '10/08/2026 12:00')
}

describe('preparación del PDF de Históricos', () => {
  it('exporta sin filtros exactamente todos los movimientos y sus totales en céntimos', () => {
    const report = prepare()

    expect(report).toMatchObject({
      totalContributionsInCents: 3300,
      totalExpensesInCents: 1700,
      balanceInCents: 1600,
    })
    expect(report?.movements.map((movement) => movement.amountInCents)).toEqual([1200, 2000, 500, 1000, 300])
  })

  it('respeta un rango de fechas inclusivo del resultado filtrado', () => {
    const report = prepare({ ...EMPTY_HISTORICAL_FILTERS, from: '2026-08-05', to: '2026-08-08' })

    expect(report?.movements).toHaveLength(2)
    expect(report).toMatchObject({ totalContributionsInCents: 2000, totalExpensesInCents: 500, balanceInCents: 1500 })
  })

  it('recibe exactamente las filas visibles cuando se filtra el mes actual', () => {
    const filters = { ...EMPTY_HISTORICAL_FILTERS, from: '2026-08-01', to: '2026-08-31' }
    const visibleEntries = filterOperationalHistory(entries, filters)
    const report = prepareHistoricalPdfReport('Cafés Semanal', visibleEntries, filters, people, '10/08/2026 12:00')

    expect(report?.movements).toHaveLength(4)
    expect(report).toMatchObject({ totalContributionsInCents: 3000, totalExpensesInCents: 1700, balanceInCents: 1300 })
  })

  it('para una persona suma sus aportaciones y solo su asignación en los gastos participantes', () => {
    const filters = { ...EMPTY_HISTORICAL_FILTERS, personId: 'ana' as const }
    const report = prepare(filters)

    expect(report?.movements.map((movement) => movement.amountInCents)).toEqual([200, 1000, 300])
    expect(report).toMatchObject({ totalContributionsInCents: 1300, totalExpensesInCents: 200, balanceInCents: 1100 })
    expect(report?.filters).toContain('Persona: Ana')
  })

  it('mantiene disponible para PDF el histórico de una persona inactiva', () => {
    const report = prepare({ ...EMPTY_HISTORICAL_FILTERS, personId: 'ana' })

    expect(report?.movements).toHaveLength(3)
  })

  it('respeta los filtros de solo aportaciones y solo gastos', () => {
    expect(prepare({ ...EMPTY_HISTORICAL_FILTERS, movementType: 'contribution' })).toMatchObject({
      totalContributionsInCents: 3300,
      totalExpensesInCents: 0,
      balanceInCents: 3300,
    })
    expect(prepare({ ...EMPTY_HISTORICAL_FILTERS, movementType: 'expense' })).toMatchObject({
      totalContributionsInCents: 0,
      totalExpensesInCents: 1700,
      balanceInCents: -1700,
    })
  })

  it('respeta combinaciones de persona, tipo y fechas', () => {
    const report = prepare({ from: '2026-08-05', to: '2026-08-05', personId: 'ana', movementType: 'expense' })

    expect(report?.movements).toHaveLength(1)
    expect(report).toMatchObject({ totalExpensesInCents: 200, balanceInCents: -200 })
  })

  it('no prepara documento cuando el resultado filtrado está vacío', () => {
    const filters = { ...EMPTY_HISTORICAL_FILTERS, from: '2026-09-01' }

    expect(prepare(filters)).toBeNull()
  })

  it('genera un nombre de archivo claro y un PDF válido de varias capas', () => {
    const report = prepare()
    if (report === null) throw new Error('El informe de prueba debe tener movimientos.')

    expect(historicalPdfFilename('Cafés Semanal', { ...EMPTY_HISTORICAL_FILTERS, from: '2026-08-01', to: '2026-08-10' }))
      .toBe('historico-cafes-semanal-2026-08-01-2026-08-10.pdf')
    expect(createHistoricalPdfDocument(report).type).toBe('application/pdf')
    expect(createHistoricalPdfDocument(report).size).toBeGreaterThan(100)
  })

  it('presenta fecha española, moneda en euros y caracteres españoles', () => {
    expect(formatPdfDate('2026-08-08')).toBe('08/08/2026')
    expect(formatPdfDate(null)).toBe('Sin fecha histórica')
    expect(formatPdfMoney(2000)).toBe('20,00 €')
    expect(formatPdfMoney(-1)).toBe('-0,01 €')
  })

  it('incluye cabecera, filtros activos, movimientos legibles y resumen final', () => {
    const report = prepare({ ...EMPTY_HISTORICAL_FILTERS, from: '2026-08-01', personId: 'ana' })
    if (report === null) throw new Error('El informe de prueba debe tener movimientos.')
    const rendered = createHistoricalPdfPages(report).join('\n')

    expect(rendered).toContain('GASTOS DEL GRUPO')
    expect(rendered).toContain('Histórico')
    expect(rendered).toContain('Grupo: Cafés Semanal')
    expect(rendered).toContain('Desde: 01/08/2026')
    expect(rendered).toContain('Persona: Ana')
    expect(rendered).toContain('Aportación')
    expect(rendered).toContain('RESUMEN FINAL')
    expect(rendered).toContain('10,00 €')
    expect(rendered).toContain('2,00 €')
  })

  it('crea páginas adicionales sin cortar movimientos ni el resumen final', () => {
    const report = prepare()
    if (report === null) throw new Error('El informe de prueba debe tener movimientos.')
    const longReport = { ...report, movements: Array.from({ length: 80 }, (_, index) => ({ ...report.movements[index % report.movements.length], description: `Movimiento ${index} con concepto razonablemente largo para comprobar el salto de página` })) }
    const pages = createHistoricalPdfPages(longReport)

    expect(pages.length).toBeGreaterThan(1)
    expect(pages.at(-1)).toContain('RESUMEN FINAL')
    expect(pages.every((page, index) => page.includes(`Página ${index + 1} de ${pages.length}`))).toBe(true)
  })
})
