import { createMonthlyContributionsPdfDocument, type prepareMonthlyContributionsPdf } from './monthly-contributions-pdf'
import { sharePdfBlob, type NativeFileShareApi, type PdfShareResult } from './native-pdf-share'

export function shareMonthlyContributionsPdf(
  report: ReturnType<typeof prepareMonthlyContributionsPdf>,
  filename: string,
  title: string,
  api: NativeFileShareApi = navigator,
): Promise<PdfShareResult> {
  return sharePdfBlob(createMonthlyContributionsPdfDocument(report), filename, title, api)
}
