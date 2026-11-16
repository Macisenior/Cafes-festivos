import { createStyledPdfDocument, type StyledPdfReport } from './historical-pdf'
import { sharePdfBlob, type NativeFileShareApi, type PdfShareResult } from './native-pdf-share'

export function shareMonthlyContributionsPdf(
  report: StyledPdfReport,
  filename: string,
  title: string,
  api: NativeFileShareApi = navigator,
): Promise<PdfShareResult> {
  return sharePdfBlob(createStyledPdfDocument(report), filename, title, api)
}
