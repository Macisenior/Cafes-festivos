import { describe, expect, it, vi } from 'vitest'
import { createPdfFile, sharePdfBlob } from './native-pdf-share'

const pdf = new Blob(['%PDF-1.4 prueba'], { type: 'application/pdf' })

describe('compartición nativa reutilizable de PDF', () => {
  it('crea y comparte un archivo PDF mediante la hoja nativa', async () => {
    const api = { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockResolvedValue(undefined) }
    const file = createPdfFile(pdf, 'informe.pdf')
    expect(file).toMatchObject({ name: 'informe.pdf', type: 'application/pdf' })
    await expect(sharePdfBlob(pdf, 'informe.pdf', 'Informe', api)).resolves.toBe('shared')
    expect(api.canShare).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: 'informe.pdf' })] })
    expect(api.share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: 'informe.pdf' })], title: 'Informe' })
  })

  it('detecta APIs incompatibles, PDF no admitido y cancelación', async () => {
    await expect(sharePdfBlob(pdf, 'informe.pdf', 'Informe', {})).resolves.toBe('unsupported')
    await expect(sharePdfBlob(pdf, 'informe.pdf', 'Informe', { canShare: vi.fn().mockReturnValue(false), share: vi.fn() })).resolves.toBe('unsupported')
    const cancelled = { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockRejectedValue(new DOMException('Cancelado', 'AbortError')) }
    await expect(sharePdfBlob(pdf, 'informe.pdf', 'Informe', cancelled)).resolves.toBe('cancelled')
  })

  it('propaga errores reales de la hoja nativa', async () => {
    const failure = new Error('Fallo nativo')
    const api = { canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockRejectedValue(failure) }
    await expect(sharePdfBlob(pdf, 'informe.pdf', 'Informe', api)).rejects.toBe(failure)
  })
})
