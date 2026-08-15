import type { Expense, GroupId } from '../../domain/entities'

function normalizedSiteKey(siteName: string): string {
  return siteName.trim().toLocaleLowerCase('es-ES')
}

/**
 * Sugiere sitios ya usados por el grupo activo sin convertirlos en un catálogo
 * restrictivo. Conserva la primera grafía histórica y excluye los accesos fijos.
 */
export function createHistoricalSiteSuggestions(
  groupId: GroupId,
  expenses: readonly Expense[],
  fixedSiteNames: readonly string[],
): readonly string[] {
  const fixedKeys = new Set(fixedSiteNames.map(normalizedSiteKey))
  const seenKeys = new Set<string>()

  return expenses
    .filter((expense) => expense.groupId === groupId)
    .map((expense) => expense.siteName.trim())
    .filter((siteName) => {
      const key = normalizedSiteKey(siteName)
      if (siteName === '' || fixedKeys.has(key) || seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })
    .sort((left, right) => left.localeCompare(right, 'es-ES'))
}