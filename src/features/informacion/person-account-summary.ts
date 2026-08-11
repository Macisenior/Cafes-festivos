import type { PersonBalance } from '../../domain/balances'
import type { Contribution, Expense, GroupId, Person } from '../../domain/entities'
import { createOperationalHistory } from '../operativa/operational-history'

export interface PersonAccountRecentMovement {
  id: string
  kind: 'contribution' | 'expense'
  date: string | null
  title: string
  amountInCents: number
  isInheritedOpening: boolean
}

export interface PersonAccountSummary {
  contributedInCents: number
  spentInCents: number
  balanceInCents: number
  recentMovements: readonly PersonAccountRecentMovement[]
}

/**
 * Detalle de consulta: reutiliza el historial V4 y el balance ya derivado.
 * Un gasto aporta únicamente su asignación final para la persona consultada.
 */
export function createPersonAccountSummary(
  groupId: GroupId,
  personId: string,
  balance: PersonBalance,
  people: readonly Person[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
  maxMovements = 4,
): PersonAccountSummary {
  const recentMovements = createOperationalHistory(groupId, people, contributions, expenses)
    .flatMap((entry): readonly PersonAccountRecentMovement[] => {
      if (entry.kind === 'contribution') {
        return entry.personId === personId ? [{
          id: entry.id,
          kind: 'contribution',
          date: entry.date,
          title: entry.isInheritedOpening ? 'Inicio' : 'Aportación',
          amountInCents: entry.amountInCents,
          isInheritedOpening: entry.isInheritedOpening,
        }] : []
      }

      const allocation = entry.allocations.find((candidate) => candidate.personId === personId)
      return allocation === undefined ? [] : [{
        id: entry.id,
        kind: 'expense',
        date: entry.date,
        title: `${entry.siteName} · ${entry.concept}`,
        amountInCents: allocation.amountInCents,
        isInheritedOpening: false,
      }]
    })
    .slice(0, maxMovements)

  return {
    contributedInCents: balance.contributedInCents,
    spentInCents: balance.spentInCents,
    balanceInCents: balance.availableInCents,
    recentMovements,
  }
}
