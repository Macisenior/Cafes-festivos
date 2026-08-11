import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'
import {
  createAccountStateAtDateReport,
  type AccountStateAtDateReport,
} from './account-state-at-date'

export interface StateBetweenDatesSnapshot extends AccountStateAtDateReport {
  date: string
}

export interface StateBetweenDatesReport {
  groupId: string
  from: string
  to: string
  openingDate: string
  opening: AccountStateAtDateReport
  snapshots: readonly StateBetweenDatesSnapshot[]
  closing: AccountStateAtDateReport
  hasMovementsInRange: boolean
  openingBalanceInCents: AmountInCents
  closingBalanceInCents: AmountInCents
}

function previousIsoDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const previous = new Date(Date.UTC(year, month - 1, day - 1))
  return previous.toISOString().slice(0, 10)
}

/**
 * Genera los estados acumulados en las fechas con movimiento del intervalo.
 * Cada estado se delega al informe "Estado a una fecha", que a su vez usa el
 * motor financiero V4; no se mantienen saldos propios ni acumulados.
 */
export function createStateBetweenDatesReport(
  group: Group,
  people: readonly Person[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
  from: string,
  to: string,
): StateBetweenDatesReport {
  // Reutiliza su validación ISO y fuerza que las fechas sean reales antes de operar con ellas.
  createAccountStateAtDateReport(group, people, contributions, expenses, from)
  const closing = createAccountStateAtDateReport(group, people, contributions, expenses, to)
  if (from > to) throw new Error('La fecha Desde no puede ser posterior a Hasta.')

  const openingDate = previousIsoDay(from)
  const opening = createAccountStateAtDateReport(group, people, contributions, expenses, openingDate)
  const movementDates = new Set<string>()

  contributions.forEach((contribution) => {
    if (contribution.groupId === group.id && contribution.date !== null && contribution.date >= from && contribution.date <= to) {
      movementDates.add(contribution.date)
    }
  })
  expenses.forEach((expense) => {
    if (expense.groupId === group.id && expense.date >= from && expense.date <= to) movementDates.add(expense.date)
  })

  // El cierre se muestra siempre, incluso cuando no hubo movimientos en el intervalo.
  movementDates.add(to)
  const snapshots = [...movementDates]
    .sort((left, right) => left.localeCompare(right))
    .map((date) => createAccountStateAtDateReport(group, people, contributions, expenses, date))

  return {
    groupId: group.id,
    from,
    to,
    openingDate,
    opening,
    snapshots,
    closing,
    hasMovementsInRange: movementDates.size > 1 || (movementDates.size === 1 && !movementDates.has(to) ? true : [...contributions, ...expenses].some((movement) => movement.groupId === group.id && movement.date === to)),
    openingBalanceInCents: opening.groupBalanceInCents,
    closingBalanceInCents: closing.groupBalanceInCents,
  }
}
