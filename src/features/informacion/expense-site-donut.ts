import type { ExpenseBySiteSegment } from './expenses-by-site'

const SITE_COLORS = ['#159a80', '#5079c7', '#d28342', '#a362a9', '#bf5e6a', '#627f76'] as const

function normalizedSiteName(siteName: string): string {
  return siteName.trim().toLocaleLowerCase('es-ES')
}

function stableIndex(siteName: string): number {
  return [...normalizedSiteName(siteName)].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0)
}

/** Color estable por sitio: no depende de su posición ni del grupo activo. */
export function colorForExpenseSite(siteName: string): string {
  return SITE_COLORS[stableIndex(siteName) % SITE_COLORS.length]
}

export interface ExpenseSiteDonutSlice extends ExpenseBySiteSegment {
  color: string
  dashOffset: number
}

/** Prepara únicamente geometría visual a partir de porcentajes ya calculados. */
export function createExpenseSiteDonutSlices(
  segments: readonly ExpenseBySiteSegment[],
  circumference: number,
): readonly ExpenseSiteDonutSlice[] {
  let consumedPercentage = 0
  return segments.map((segment) => {
    const slice = {
      ...segment,
      color: colorForExpenseSite(segment.siteName),
      dashOffset: consumedPercentage === 0 ? 0 : -(consumedPercentage / 100) * circumference,
    }
    consumedPercentage += segment.percentageOfGroupTotal
    return slice
  })
}
