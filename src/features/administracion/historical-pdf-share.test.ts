import { describe, expect, it, vi } from 'vitest'
import type { HistoricalPdfReport } from './historical-pdf'
import { createHistoricalPdfFile, shareHistoricalPdf } from './historical-pdf-share'

const report: HistoricalPdfReport = {
  groupName: 'Cafés Semanal',
  generatedOn: '20/10/2026 12:00',
  filters: ['Tipo: Todos'],
  movements: [{ kind: 'contribution', date: '2026-10-20', description: 'Aportación · Ana', amountInCents: 1000 }],
  totalContributionsInCents: 1000,
  totalExpensesInCents: 0,
  balanceInCents: 1000,
}

describe('compartición del PDF histórico', () => {
  it('crea un archivo con los mismos bytes y tipo del PDF generado', async () => {
    const file = createHistoricalPdfFile(report, 'historico.pdf')

    expect(file.name).toBe('historico.pdf')
    expect(file.type).toBe('application/pdf')
    expect(file.size).toBeGreaterThan(100)
  })

  it('abre la hoja nativa con el archivo PDF cuando el navegador lo admite', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const api = { canShare: vi.fn().mockReturnValue(true), share }

    await expect(shareHistoricalPdf(report, 'historico.pdf', 'Histórico', api)).resolves.toBe('shared')
    const sharedFile = api.canShare.mock.calls[0][0].files[0]
    expect(api.canShare).toHaveBeenCalledWith({ files: [sharedFile] })
    expect(share).toHaveBeenCalledWith({ files: [sharedFile], title: 'Histórico' })
    expect(sharedFile).toMatchObject({ name: 'historico.pdf', type: 'application/pdf' })
  })

  it('no intenta compartir cuando faltan las API o el PDF no está admitido', async () => {
    await expect(shareHistoricalPdf(report, 'historico.pdf', 'Histórico', {})).resolves.toBe('unsupported')

    const api = { canShare: vi.fn().mockReturnValue(false), share: vi.fn() }
    await expect(shareHistoricalPdf(report, 'historico.pdf', 'Histórico', api)).resolves.toBe('unsupported')
    expect(api.share).not.toHaveBeenCalled()
  })

  it('trata la cancelación del selector como un resultado normal', async () => {
    const api = {
      canShare: vi.fn().mockReturnValue(true),
      share: vi.fn().mockRejectedValue(new DOMException('Cancelado', 'AbortError')),
    }

    await expect(shareHistoricalPdf(report, 'historico.pdf', 'Histórico', api)).resolves.toBe('cancelled')
  })

  it('propaga otros errores producidos por la hoja nativa', async () => {
    const failure = new Error('Fallo nativo')
    const api = { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockRejectedValue(failure) }

    await expect(shareHistoricalPdf(report, 'historico.pdf', 'Histórico', api)).rejects.toBe(failure)
  })
})
