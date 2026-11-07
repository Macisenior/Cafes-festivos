import { createMonthlyIndividualPdfDocument, type MonthlyIndividualPdfReport } from './monthly-individual-statement-pdf'

export type MonthlyIndividualShareResult = 'shared' | 'cancelled' | 'unsupported'
export interface NativeMonthlyShareApi { canShare?: (data: ShareData) => boolean; share?: (data: ShareData) => Promise<void> }

export function createMonthlyIndividualPdfFile(report: MonthlyIndividualPdfReport, filename: string): File {
  const pdf = createMonthlyIndividualPdfDocument(report)
  return new File([pdf], filename, { type: pdf.type })
}

/** Abre la hoja nativa para que el usuario elija WhatsApp manualmente. */
export async function shareMonthlyIndividualPdf(report: MonthlyIndividualPdfReport, filename: string, api: NativeMonthlyShareApi = navigator): Promise<MonthlyIndividualShareResult> {
  const file = createMonthlyIndividualPdfFile(report, filename)
  if (typeof api.canShare !== 'function' || typeof api.share !== 'function') return 'unsupported'
  try { if (!api.canShare({ files: [file] })) return 'unsupported' } catch { return 'unsupported' }
  try {
    await api.share({ files: [file], title: 'Extracto mensual individual' })
    return 'shared'
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return 'cancelled'
    throw reason
  }
}
