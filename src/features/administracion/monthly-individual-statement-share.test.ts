import { describe, expect, it, vi } from 'vitest'
import { shareMonthlyIndividualPdf } from './monthly-individual-statement-share'
import type { MonthlyIndividualPdfReport } from './monthly-individual-statement-pdf'

const report: MonthlyIndividualPdfReport = { groupId: 'g', groupName: 'G', personId: 'p', personName: 'Ana', month: '2026-10', from: '2026-10-01', to: '2026-10-31', openingDate: '2026-09-30', generatedOn: '', openingBalanceInCents: 0, closingBalanceInCents: 0, movements: [] }

describe('compartición del extracto mensual', () => {
  it('abre la hoja nativa con el PDF para elegir WhatsApp manualmente', async () => {
    const api = { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockResolvedValue(undefined) }
    await expect(shareMonthlyIndividualPdf(report, 'extracto.pdf', api)).resolves.toBe('shared')
    expect(api.share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Extracto mensual individual', files: [expect.objectContaining({ name: 'extracto.pdf', type: 'application/pdf' })] }))
  })

  it('informa de navegadores incompatibles y cancelaciones sin fallar', async () => {
    await expect(shareMonthlyIndividualPdf(report, 'extracto.pdf', {})).resolves.toBe('unsupported')
    const api = { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockRejectedValue(new DOMException('Cancelado', 'AbortError')) }
    await expect(shareMonthlyIndividualPdf(report, 'extracto.pdf', api)).resolves.toBe('cancelled')
  })
})
