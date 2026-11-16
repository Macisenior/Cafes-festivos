import { describe, expect, it, vi } from 'vitest'
import type { MonthlyContributionsReport } from './monthly-contributions'
import { prepareMonthlyContributionsPdf } from './monthly-contributions-pdf'
import { shareMonthlyContributionsPdf } from './monthly-contributions-share'

const monthly: MonthlyContributionsReport = {
  groupId: 'general', range: { fromMonth: '2026-01', toMonth: '2026-01' },
  months: [{ month: '2026-01', people: [{ personId: 'ana', personName: 'Ana', isActive: true, contributedInCents: 1000 }], totalInCents: 1000, contributionCount: 1 }],
  totalInRangeInCents: 1000, inheritedOpeningByPerson: [], inheritedOpeningTotalInCents: 0,
}

describe('compartición de aportaciones mensuales', () => {
  it.each(['summary', 'detailed'] as const)('comparte el PDF %s con nombre, tipo y título correctos', async (mode) => {
    const api = { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockResolvedValue(undefined) }
    const report = prepareMonthlyContributionsPdf('Cafés', monthly, '16/11/2026', mode)
    await expect(shareMonthlyContributionsPdf(report, `${mode}.pdf`, `Mensual ${mode}`, api)).resolves.toBe('shared')
    expect(api.share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: `${mode}.pdf`, type: 'application/pdf' })], title: `Mensual ${mode}` })
  })

  it('informa de navegador incompatible sin intentar compartir', async () => {
    const api = { canShare: vi.fn().mockReturnValue(false), share: vi.fn() }
    const report = prepareMonthlyContributionsPdf('Cafés', monthly, '16/11/2026', 'summary')
    await expect(shareMonthlyContributionsPdf(report, 'summary.pdf', 'Resumen', api)).resolves.toBe('unsupported')
    expect(api.share).not.toHaveBeenCalled()
  })
})
