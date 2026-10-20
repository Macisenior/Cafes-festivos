import { createHistoricalPdfDocument, type HistoricalPdfReport } from './historical-pdf'

export type HistoricalPdfShareResult = 'shared' | 'cancelled' | 'unsupported'

export interface NativeFileShareApi {
  canShare?: (data: ShareData) => boolean
  share?: (data: ShareData) => Promise<void>
}

export function createHistoricalPdfFile(report: HistoricalPdfReport, filename: string): File {
  const pdf = createHistoricalPdfDocument(report)
  return new File([pdf], filename, { type: pdf.type })
}

/** Invoca la hoja nativa durante el mismo gesto del usuario que genera el PDF. */
export async function shareHistoricalPdf(
  report: HistoricalPdfReport,
  filename: string,
  title: string,
  api: NativeFileShareApi = navigator,
): Promise<HistoricalPdfShareResult> {
  const file = createHistoricalPdfFile(report, filename)
  if (typeof api.canShare !== 'function' || typeof api.share !== 'function') return 'unsupported'

  try {
    if (!api.canShare({ files: [file] })) return 'unsupported'
  } catch {
    return 'unsupported'
  }

  try {
    await api.share({ files: [file], title })
    return 'shared'
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return 'cancelled'
    throw reason
  }
}
