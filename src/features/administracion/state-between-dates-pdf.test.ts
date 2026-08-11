import { describe, expect, it } from 'vitest'
import { createStyledPdfPages } from './historical-pdf'
import { prepareStateBetweenDatesPdf } from './state-between-dates-pdf'
import type { StateBetweenDatesReport } from './state-between-dates'

const report: StateBetweenDatesReport = {
  groupId: 'general', from: '2026-08-01', to: '2026-08-10', openingDate: '2026-07-31', hasMovementsInRange: true,
  openingBalanceInCents: 1000, closingBalanceInCents: 2500,
  opening: { groupId: 'general', date: '2026-07-31', people: [], groupContributedInCents: 1000, groupSpentInCents: 0, groupBalanceInCents: 1000 },
  closing: { groupId: 'general', date: '2026-08-10', people: [{ personId: 'ana', personName: 'Ana', isActive: false, contributedInCents: 3000, spentInCents: 500, balanceInCents: 2500 }], groupContributedInCents: 3000, groupSpentInCents: 500, groupBalanceInCents: 2500 },
  snapshots: [{ groupId: 'general', date: '2026-08-10', people: [{ personId: 'ana', personName: 'Ana', isActive: false, contributedInCents: 3000, spentInCents: 500, balanceInCents: 2500 }], groupContributedInCents: 3000, groupSpentInCents: 500, groupBalanceInCents: 2500 }],
}

describe('PDF de Estado entre fechas', () => {
  it('recibe el mismo informe preparado que muestra la pantalla', () => {
    const pdf = prepareStateBetweenDatesPdf('Cafés Semanal', report, '10/08/2026 12:00')

    expect(pdf?.rows).toMatchObject([{ title: '10/08/2026', amountInCents: 2500 }])
    expect(pdf?.summary.map((line) => line.amountInCents)).toEqual([1000, 2500])
    expect(createStyledPdfPages(pdf!).join('\n')).toContain('Aperturas heredadas sin fecha')
  })

  it('no prepara PDF cuando el grupo no tiene personas', () => {
    expect(prepareStateBetweenDatesPdf('Vacío', { ...report, closing: { ...report.closing, people: [] } }, '10/08/2026 12:00')).toBeNull()
  })
})
