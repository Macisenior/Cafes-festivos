import { describe, expect, it } from 'vitest'
import type { AccountStateAtDateReport } from './account-state-at-date'
import { createStyledPdfDocument, createStyledPdfPages } from './historical-pdf'
import { prepareAccountStateAtDatePdf } from './account-state-at-date-pdf'

const report: AccountStateAtDateReport = {
  groupId: 'general', date: '2026-08-10',
  people: [{ personId: 'ana', personName: 'Ana', isActive: false, contributedInCents: 2000, spentInCents: 800, balanceInCents: 1200 }],
  groupContributedInCents: 2000, groupSpentInCents: 800, groupBalanceInCents: 1200,
}

describe('PDF de Estado a una fecha', () => {
  it('recibe el mismo informe preparado para pantalla sin volver a calcularlo', () => {
    const pdf = prepareAccountStateAtDatePdf('Cafés Semanal', report, '10/08/2026 12:00')

    expect(pdf?.rows).toMatchObject([{ title: 'Ana', amountInCents: 1200 }])
    expect(pdf?.summary.map((line) => line.amountInCents)).toEqual([2000, 800, 1200])
    expect(pdf?.filters).toContain('Fecha de consulta: 10/08/2026')
  })

  it('reutiliza la plantilla visual V4 y refleja aportado, gastado, saldo e inactividad', () => {
    const pdf = prepareAccountStateAtDatePdf('Cafés Semanal', report, '10/08/2026 12:00')
    if (pdf === null) throw new Error('El PDF de prueba debe existir.')
    const pages = createStyledPdfPages(pdf).join('\n')

    expect(pages).toContain('Estado a una fecha')
    expect(pages).toContain('Aportado: 20,00 €')
    expect(pages).toContain('Gastado: 8,00 €')
    expect(pages).toContain('Persona inactiva')
    expect(pages).toContain('SALDO DEL GRUPO')
    expect(pages).toContain('incluidas como saldo inicial')
    expect(createStyledPdfDocument(pdf).type).toBe('application/pdf')
  })

  it('no prepara PDF si el grupo no tiene personas', () => {
    expect(prepareAccountStateAtDatePdf('Vacío', { ...report, people: [] }, '10/08/2026')).toBeNull()
  })
})
