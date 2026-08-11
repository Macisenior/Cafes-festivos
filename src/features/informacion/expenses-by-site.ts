import type { Expense, GroupId } from '../../domain/entities'

/**
 * Un segmento de consulta listo para una futura representación donut. El valor
 * se conserva en céntimos: esta función no redondea ni recalcula gastos.
 */
export interface ExpenseBySiteSegment {
  siteName: string
  totalInCents: number
  percentageOfGroupTotal: number
}

function isValidExpenseForSiteSummary(expense: Expense, groupId: GroupId): boolean {
  return expense.groupId === groupId
    && expense.siteName.trim().length > 0
    && Number.isSafeInteger(expense.totalInCents)
    && expense.totalInCents > 0
}

/**
 * Agrupa los importes ya persistidos por sitio para un único grupo V4.
 * No usa repartos ni participa en el cálculo de balances.
 */
export function createExpensesBySite(
  groupId: GroupId,
  expenses: readonly Expense[],
): readonly ExpenseBySiteSegment[] {
  const totalsBySite = new Map<string, number>()

  for (const expense of expenses) {
    if (!isValidExpenseForSiteSummary(expense, groupId)) continue

    const siteName = expense.siteName.trim()
    totalsBySite.set(siteName, (totalsBySite.get(siteName) ?? 0) + expense.totalInCents)
  }

  const groupTotalInCents = [...totalsBySite.values()].reduce((total, amount) => total + amount, 0)

  return [...totalsBySite.entries()]
    .map(([siteName, totalInCents]) => ({
      siteName,
      totalInCents,
      percentageOfGroupTotal: groupTotalInCents === 0 ? 0 : (totalInCents / groupTotalInCents) * 100,
    }))
    .sort((left, right) => right.totalInCents - left.totalInCents || left.siteName.localeCompare(right.siteName))
}
