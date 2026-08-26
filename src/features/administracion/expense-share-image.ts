import type { Expense } from '../../domain/entities'

export type ExpenseImageShareResult = 'shared' | 'downloaded'

export interface NativeFileShareApi {
  canShare?: (data: ShareData) => boolean
  share?: (data: ShareData) => Promise<void>
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function createExpenseShareFilename(groupName: string, expense: Expense): string {
  const safeGroup = groupName.trim().toLocaleLowerCase('es-ES').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'grupo'
  return `detalle-gasto-${safeGroup}-${expense.date}-${expense.id}.png`
}

/** Solo permite compartir por sistema si el navegador acepta explícitamente el PNG. */
export function canShareExpenseImage(file: File, api: NativeFileShareApi): boolean {
  return typeof api.share === 'function' && typeof api.canShare === 'function' && api.canShare({ files: [file] })
}

/** Usa la hoja nativa en móvil/PWA o descarga el PNG como alternativa compatible. */
export async function shareExpenseImage(
  file: File,
  title: string,
  api: NativeFileShareApi = navigator,
  download: (downloadedFile: File) => void = downloadFile,
): Promise<ExpenseImageShareResult> {
  if (canShareExpenseImage(file, api)) {
    await api.share!({ files: [file], title })
    return 'shared'
  }
  download(file)
  return 'downloaded'
}

/** Renderiza exclusivamente la tarjeta de compartición en PNG; no captura el modal ni la aplicación. */
export async function createExpenseShareImageFile(node: HTMLElement, filename: string): Promise<File> {
  const { toBlob } = await import('html-to-image')
  const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })
  if (blob === null) throw new Error('No se ha podido generar la imagen del gasto.')
  return new File([blob], filename, { type: 'image/png' })
}