import type { Contribution, Expense, GroupId, Person } from '../../domain/entities'
import type { ExpenseAllocation, ExpenseDistributionMode, PersonId } from '../../domain/reparto'

export type OperationalHistoryEntry =
  | {
      id: string
      kind: 'contribution'
      date: string | null
      personId: PersonId
      personName: string
      amountInCents: number
      isInheritedOpening: boolean
    }
  | {
      id: string
      kind: 'expense'
      date: string
      concept: string
      siteName: string
      amountInCents: number
      participantsCount: number
      participantIds: readonly PersonId[]
      allocations: readonly ExpenseAllocation[]
      distributionMode: ExpenseDistributionMode
    }

/** Compone una cronología de consulta sin alterar ni recalcular movimientos. */
export function createOperationalHistory(
  groupId: GroupId,
  people: readonly Person[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
): readonly OperationalHistoryEntry[] {
  const personNames = new Map(
    people.filter((person) => person.groupId === groupId).map((person) => [person.id, person.name]),
  )
  const contributionEntries: OperationalHistoryEntry[] = contributions
    .filter((contribution) => contribution.groupId === groupId)
    .map((contribution) => ({
      id: contribution.id,
      kind: 'contribution' as const,
      date: contribution.date,
      personId: contribution.personId,
      personName: personNames.get(contribution.personId) ?? 'Persona no disponible',
      amountInCents: contribution.amountInCents,
      isInheritedOpening: contribution.source === 'v3-opening',
    }))
  const expenseEntries: OperationalHistoryEntry[] = expenses
    .filter((expense) => expense.groupId === groupId)
    .map((expense) => ({
      id: expense.id,
      kind: 'expense' as const,
      date: expense.date,
      concept: expense.concept,
      siteName: expense.siteName,
      amountInCents: expense.totalInCents,
      participantsCount: expense.participantIds.length,
      participantIds: expense.participantIds,
      allocations: expense.allocations,
      distributionMode: expense.distribution.mode,
    }))

  return [...contributionEntries, ...expenseEntries].sort((left, right) => {
    const leftDate = left.date ?? ''
    const rightDate = right.date ?? ''

    return rightDate.localeCompare(leftDate) || right.id.localeCompare(left.id)
  })
}
