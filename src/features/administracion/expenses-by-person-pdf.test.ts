import { describe, expect, it } from 'vitest'
import type { ExpensesByPersonReport } from './expenses-by-person'
import { createStyledPdfDocument, createStyledPdfPages } from './historical-pdf'
import { prepareExpensesByPersonPdf } from './expenses-by-person-pdf'

const report: ExpensesByPersonReport = {
  groupId: 'general',
  range: { from: '2026-08-01', to: '2026-08-10' },
  people: [
    { personId: 'ana', personName: 'Ana', isActive: false, spentInCents: 934 },
    { personId: 'bea', personName: 'Bea', isActive: true, spentInCents: 883 },
  ],
  totalExpensesInCents: 1817,
  totalAssignedInCents: 1817,
}

describe('PDF de Gastos por persona', () => {
  it('adapta exactamente el resultado que se muestra, incluido el total general', () => {
    const pdf = prepareExpensesByPersonPdf('Cafés Semanal', report, '10/08/2026 12:00')

    expect(pdf).toMatchObject({ title: 'Gastos por persona', groupName: 'Cafés Semanal' })
    expect(pdf?.rows.map((row) => row.amountInCents)).toEqual([934, 883])
    expect(pdf?.summary).toEqual([{ label: 'TOTAL GENERAL', amountInCents: 1817, tone: 'negative' }])
    expect(pdf?.filters).toEqual(['Desde: 01/08/2026', 'Hasta: 10/08/2026'])
  })

  it('reutiliza la plantilla PDF V4 con formato español y persona inactiva', () => {
    const pdf = prepareExpensesByPersonPdf('Cafés Semanal', report, '10/08/2026 12:00')
    if (pdf === null) throw new Error('El PDF de prueba debe existir.')
    const pages = createStyledPdfPages(pdf).join('\n')

    expect(pages).toContain('Gastos por persona')
    expect(pages).toContain('Ana')
    expect(pages).toContain('Persona inactiva con historial')
    expect(pages).toContain('18,17 €')
    expect(createStyledPdfDocument(pdf).type).toBe('application/pdf')
  })

  it('no prepara PDF cuando no hay personas en el resultado', () => {
    expect(prepareExpensesByPersonPdf('Vacío', { ...report, people: [] }, '10/08/2026')).toBeNull()
    expect(prepareExpensesByPersonPdf('Vacío', { ...report, totalExpensesInCents: 0, totalAssignedInCents: 0 }, '10/08/2026')).toBeNull()
  })
})
