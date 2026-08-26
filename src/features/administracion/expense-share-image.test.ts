import { describe, expect, it, vi } from 'vitest'
import type { Expense } from '../../domain/entities'
import { canShareExpenseImage, createExpenseShareFilename, shareExpenseImage } from './expense-share-image'

const file = { name: 'detalle.png', type: 'image/png' } as File
const expense = { id: 'gasto-1', groupId: 'general', date: '2026-08-25' } as Expense

describe('compartición de imagen de gasto', () => {
  it('usa la hoja nativa cuando el navegador confirma que acepta archivos', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const api = { canShare: vi.fn().mockReturnValue(true), share }

    await expect(shareExpenseImage(file, 'Detalle de gasto', api)).resolves.toBe('shared')
    expect(api.canShare).toHaveBeenCalledWith({ files: [file] })
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Detalle de gasto' })
    expect(canShareExpenseImage(file, api)).toBe(true)
  })

  it('descarga el PNG cuando no se puede compartir como archivo', async () => {
    const download = vi.fn()
    const api = { canShare: vi.fn().mockReturnValue(false), share: vi.fn() }

    await expect(shareExpenseImage(file, 'Detalle de gasto', api, download)).resolves.toBe('downloaded')
    expect(download).toHaveBeenCalledWith(file)
    expect(api.share).not.toHaveBeenCalled()
  })

  it('crea un nombre de archivo legible sin alterar los datos del gasto', () => {
    expect(createExpenseShareFilename('Cafés Semanal', expense)).toBe('detalle-gasto-caf-s-semanal-2026-08-25-gasto-1.png')
  })
})