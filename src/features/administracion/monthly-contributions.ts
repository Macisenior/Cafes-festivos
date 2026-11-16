import type { Contribution, GroupId, Person } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'

export interface MonthlyContributionRange { fromMonth: string; toMonth: string }
export interface MonthlyContributionPerson { personId: string; personName: string; isActive: boolean; contributedInCents: AmountInCents }
export interface MonthlyContributionMonth { month: string; people: readonly MonthlyContributionPerson[]; totalInCents: AmountInCents; contributionCount: number }
export interface MonthlyContributionsReport {
  groupId: GroupId
  range: MonthlyContributionRange
  months: readonly MonthlyContributionMonth[]
  totalInRangeInCents: AmountInCents
  inheritedOpeningByPerson: readonly MonthlyContributionPerson[]
  inheritedOpeningTotalInCents: AmountInCents
}

function assertMonth(value: string, label: string): void {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error(`${label} debe usar YYYY-MM.`)
  const month = Number(value.slice(5, 7))
  if (month < 1 || month > 12) throw new Error(`${label} no es válido.`)
}

function enumerateMonths(fromMonth: string, toMonth: string): readonly string[] {
  assertMonth(fromMonth, 'Desde mes')
  assertMonth(toMonth, 'Hasta mes')
  if (fromMonth > toMonth) throw new Error('Desde mes no puede ser posterior a Hasta mes.')
  const [fromYear, fromNumber] = fromMonth.split('-').map(Number)
  const [toYear, toNumber] = toMonth.split('-').map(Number)
  const months: string[] = []
  let year = fromYear
  let month = fromNumber
  while (year < toYear || (year === toYear && month <= toNumber)) {
    months.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month === 13) { month = 1; year += 1 }
  }
  return months
}

/** Agrupa aportaciones fechadas por mes; las aperturas sin fecha se mantienen fuera de los meses. */
export function createMonthlyContributionsReport(
  groupId: GroupId,
  people: readonly Person[],
  contributions: readonly Contribution[],
  range: MonthlyContributionRange,
): MonthlyContributionsReport {
  const groupPeople = people.filter((person) => person.groupId === groupId)
  const peopleById = new Map(groupPeople.map((person) => [person.id, person]))
  const monthKeys = enumerateMonths(range.fromMonth, range.toMonth)
  const amountsByMonth = new Map(monthKeys.map((month) => [month, new Map<string, AmountInCents>()]))
  const countsByMonth = new Map(monthKeys.map((month) => [month, 0]))
  const inheritedByPerson = new Map(groupPeople.map((person) => [person.id, 0]))

  contributions.forEach((contribution) => {
    if (contribution.groupId !== groupId || !peopleById.has(contribution.personId)) return
    if (contribution.date === null) {
      inheritedByPerson.set(contribution.personId, (inheritedByPerson.get(contribution.personId) ?? 0) + contribution.amountInCents)
      return
    }
    const month = contribution.date.slice(0, 7)
    const monthAmounts = amountsByMonth.get(month)
    if (monthAmounts === undefined) return
    monthAmounts.set(contribution.personId, (monthAmounts.get(contribution.personId) ?? 0) + contribution.amountInCents)
    countsByMonth.set(month, (countsByMonth.get(month) ?? 0) + 1)
  })

  const months = monthKeys.map((month): MonthlyContributionMonth => {
    const amounts = amountsByMonth.get(month) ?? new Map()
    const monthPeople = groupPeople
      .filter((person) => amounts.has(person.id))
      .map((person) => ({ personId: person.id, personName: person.name, isActive: person.isActive, contributedInCents: amounts.get(person.id) ?? 0 }))
    return { month, people: monthPeople, totalInCents: monthPeople.reduce((total, person) => total + person.contributedInCents, 0), contributionCount: countsByMonth.get(month) ?? 0 }
  })
  const inheritedOpeningByPerson = groupPeople
    .filter((person) => (inheritedByPerson.get(person.id) ?? 0) !== 0)
    .map((person) => ({ personId: person.id, personName: person.name, isActive: person.isActive, contributedInCents: inheritedByPerson.get(person.id) ?? 0 }))

  return {
    groupId,
    range,
    months,
    totalInRangeInCents: months.reduce((total, month) => total + month.totalInCents, 0),
    inheritedOpeningByPerson,
    inheritedOpeningTotalInCents: inheritedOpeningByPerson.reduce((total, person) => total + person.contributedInCents, 0),
  }
}

export function earliestDatedContributionMonth(groupId: GroupId, contributions: readonly Contribution[], fallbackMonth: string): string {
  return contributions
    .filter((contribution) => contribution.groupId === groupId && contribution.date !== null)
    .map((contribution) => contribution.date!.slice(0, 7))
    .sort()[0] ?? fallbackMonth
}
