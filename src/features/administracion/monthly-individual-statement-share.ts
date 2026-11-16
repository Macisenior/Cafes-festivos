import { createMonthlyIndividualPdfDocument, type MonthlyIndividualPdfReport } from './monthly-individual-statement-pdf'
import { createPdfFile, sharePdfBlob, type NativeFileShareApi, type PdfShareResult } from './native-pdf-share'

export type MonthlyIndividualShareResult = PdfShareResult
export type NativeMonthlyShareApi = NativeFileShareApi

export function createMonthlyIndividualPdfFile(report: MonthlyIndividualPdfReport, filename: string): File {
  return createPdfFile(createMonthlyIndividualPdfDocument(report), filename)
}

/** Abre la hoja nativa para que el usuario elija WhatsApp manualmente. */
export async function shareMonthlyIndividualPdf(report: MonthlyIndividualPdfReport, filename: string, api: NativeMonthlyShareApi = navigator): Promise<MonthlyIndividualShareResult> {
  return sharePdfBlob(createMonthlyIndividualPdfDocument(report), filename, 'Extracto mensual individual', api)
}
