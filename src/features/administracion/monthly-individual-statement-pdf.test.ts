import { describe, expect, it } from 'vitest'
import type { MonthlyIndividualPdfReport } from './monthly-individual-statement-pdf'
import { createMonthlyIndividualPdfDocument, createMonthlyIndividualPdfPages, monthlyIndividualPdfFilename } from './monthly-individual-statement-pdf'

const base: MonthlyIndividualPdfReport = {
  groupId: 'general', groupName: 'Grupo', personId: 'ana', personName: 'Ana Martín', month: '2026-10', from: '2026-10-01', to: '2026-10-31', openingDate: '2026-09-30', generatedOn: '07/11/2026', openingBalanceInCents: 1840, closingBalanceInCents: 5530,
  movements: [
    { id: 'e-1', kind: 'expense', date: '2026-10-02', concept: 'Café y tostada - Cafetería Central', amountInCents: 325 },
    { id: 'c-1', kind: 'contribution', date: '2026-10-06', concept: 'Aportación', amountInCents: 3000, availableInCents: 4505 },
  ],
}

describe('PDF del extracto mensual individual', () => {
  it('incluye diseño móvil, apertura, movimientos, disponible y cierre', () => {
    const rendered = createMonthlyIndividualPdfPages(base).join('\n')
    expect(rendered).toContain('EXTRACTO MENSUAL')
    expect(rendered).toContain('Saldo al comenzar el mes')
    expect(rendered).toContain('Disponible')
    expect(rendered).toContain('SALDO FINAL DEL MES')
    expect(createMonthlyIndividualPdfDocument(base)).toMatchObject({ type: 'application/pdf' })
    expect(createMonthlyIndividualPdfDocument(base).size).toBeGreaterThan(100)
  })

  it('no muestra disponible después de gastos y lo muestra una vez por aportación', () => {
    const rendered = createMonthlyIndividualPdfPages(base).join('\n')
    expect(rendered.match(/Disponible/g)).toHaveLength(1)
  })

  it('mantiene aportación y disponible en la misma página durante saltos', () => {
    const movements = Array.from({ length: 60 }, (_, index) => index % 4 === 3
      ? { id: `c-${index}`, kind: 'contribution' as const, date: '2026-10-15', concept: 'Aportación', amountInCents: 1000, availableInCents: 5000 + index }
      : { id: `e-${index}`, kind: 'expense' as const, date: '2026-10-14', concept: `Concepto largo número ${index} para comprobar paginación`, amountInCents: 100 })
    const pages = createMonthlyIndividualPdfPages({ ...base, movements })
    expect(pages.length).toBeGreaterThan(2)
    expect(pages.every((page) => (page.match(/Aportación/g)?.length ?? 0) === (page.match(/Disponible/g)?.length ?? 0))).toBe(true)
    expect(pages.at(-1)).toContain('SALDO FINAL DEL MES')
  })

  it('genera también un PDF válido para meses sin movimientos y un nombre estable', () => {
    const pages = createMonthlyIndividualPdfPages({ ...base, movements: [], closingBalanceInCents: base.openingBalanceInCents })
    expect(pages.join('\n')).toContain('Mes sin movimientos')
    expect(monthlyIndividualPdfFilename('Ana Martín', '2026-10')).toBe('extracto-mensual-ana-martin-2026-10.pdf')
  })
})
