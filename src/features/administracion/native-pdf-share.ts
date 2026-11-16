export type PdfShareResult = 'shared' | 'cancelled' | 'unsupported'
export interface NativeFileShareApi { canShare?: (data: ShareData) => boolean; share?: (data: ShareData) => Promise<void> }

export function createPdfFile(pdf: Blob, filename: string): File {
  return new File([pdf], filename, { type: pdf.type || 'application/pdf' })
}

/** Abre la hoja nativa para que el usuario elija WhatsApp y destinatario manualmente. */
export async function sharePdfBlob(
  pdf: Blob,
  filename: string,
  title: string,
  api: NativeFileShareApi = navigator,
): Promise<PdfShareResult> {
  const file = createPdfFile(pdf, filename)
  if (typeof api.canShare !== 'function' || typeof api.share !== 'function') return 'unsupported'
  try { if (!api.canShare({ files: [file] })) return 'unsupported' } catch { return 'unsupported' }
  try {
    await api.share({ files: [file], title })
    return 'shared'
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return 'cancelled'
    throw reason
  }
}
