import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'
import { createAccountStateAtDateReport } from './account-state-at-date'

export type MonthlyIndividualMovement =
  | { id: string; kind: 'contribution'; date: string; concept: string; amountInCents: AmountInCents; availableInCents: AmountInCents }
  | { id: string; kind: 'expense'; date: string; concept: string; amountInCents: AmountInCents }

export interface MonthlyIndividualStatement {
  groupId: string
  personId: string
  personName: string
  month: string
  from: string
  to: string
  openingDate: string
  openingBalanceInCents: AmountInCents
  closingBalanceInCents: AmountInCents
  movements: readonly MonthlyIndividualMovement[]
}

function monthBounds(month: string): { from: string; to: string; openingDate: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('El mes debe usar el formato YYYY-MM.')
  const [year, monthNumber] = month.split('-').map(Number)
  if (!Number.isSafeInteger(year) || year < 1 || monthNumber < 1 || monthNumber > 12) throw new Error('El mes seleccionado no es válido.')
  return {
    from: `${month}-01`,
    to: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10),
    openingDate: new Date(Date.UTC(year, monthNumber - 1, 0)).toISOString().slice(0, 10),
  }
}

/** Extracto derivado: apertura/cierre del motor V4 y asignaciones guardadas de gasto. */
export function createMonthlyIndividualStatement(
  group: Group,
  people: readonly Person[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
  personId: string,
  month: string,
): MonthlyIndividualStatement {
  const person = people.find((candidate) => candidate.groupId === group.id && candidate.id === personId)
  if (person === undefined) throw new Error('La persona seleccionada no pertenece al grupo activo.')
  const { from, to, openingDate } = monthBounds(month)
  const openingPerson = createAccountStateAtDateReport(group, people, contributions, expenses, openingDate).people.find((candidate) => candidate.personId === personId)
  const closingPerson = createAccountStateAtDateReport(group, people, contributions, expenses, to).people.find((candidate) => candidate.personId === personId)
  if (openingPerson === undefined || closingPerson === undefined) throw new Error('No se pudo reconstruir el saldo histórico de la persona.')

  const dated: Array<{ id: string; kind: 'contribution' | 'expense'; date: string; concept: string; amountInCents: AmountInCents }> = []
  contributions.forEach((contribution) => {
    if (contribution.groupId === group.id && contribution.personId === personId && contribution.date !== null && contribution.date >= from && contribution.date <= to) {
      dated.push({ id: contribution.id, kind: 'contribution', date: contribution.date, concept: 'Aportación', amountInCents: contribution.amountInCents })
    }
  })
  expenses.forEach((expense) => {
    if (expense.groupId !== group.id || expense.date < from || expense.date > to) return
    const allocation = expense.allocations.find((candidate) => candidate.personId === personId)
    if (allocation !== undefined) dated.push({ id: expense.id, kind: 'expense', date: expense.date, concept: `${expense.concept} - ${expense.siteName}`, amountInCents: allocation.amountInCents })
  })
  dated.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))

  let availableInCents = openingPerson.balanceInCents
  const movements: MonthlyIndividualMovement[] = dated.map((movement) => {
    availableInCents += movement.kind === 'contribution' ? movement.amountInCents : -movement.amountInCents
    return movement.kind === 'contribution' ? { ...movement, kind: 'contribution', availableInCents } : { ...movement, kind: 'expense' }
  })
  if (availableInCents !== closingPerson.balanceInCents) throw new Error('El extracto no coincide con el saldo de cierre calculado por V4.')

  return { groupId: group.id, personId, personName: person.name, month, from, to, openingDate, openingBalanceInCents: openingPerson.balanceInCents, closingBalanceInCents: closingPerson.balanceInCents, movements }
}
