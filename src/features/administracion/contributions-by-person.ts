import type { Contribution, GroupId, Person } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'

export interface ContributionByPersonDateRange {
  from: string
  to: string
}

export interface ContributionByPersonItem {
  personId: string
  personName: string
  isActive: boolean
  contributedInCents: AmountInCents
}

export interface ContributionsByPersonReport {
  groupId: GroupId
  range: ContributionByPersonDateRange
  people: readonly ContributionByPersonItem[]
  includedContributionCount: number
  totalContributionsInCents: AmountInCents
}

export const EMPTY_CONTRIBUTIONS_BY_PERSON_RANGE: ContributionByPersonDateRange = { from: '', to: '' }

function isIncludedContribution(contribution: Contribution, groupId: GroupId, range: ContributionByPersonDateRange): boolean {
  if (contribution.groupId !== groupId) return false
  if (contribution.date === null) return range.from === '' && range.to === ''
  return (range.from === '' || contribution.date >= range.from) && (range.to === '' || contribution.date <= range.to)
}

/**
 * Suma exclusivamente movimientos reales de aportación, incluidos los importes
 * históricos firmados. Las aportaciones sin fecha solo entran sin rango.
 */
export function createContributionsByPersonReport(
  groupId: GroupId,
  people: readonly Person[],
  contributions: readonly Contribution[],
  range: ContributionByPersonDateRange = EMPTY_CONTRIBUTIONS_BY_PERSON_RANGE,
): ContributionsByPersonReport {
  const groupPeople = people.filter((person) => person.groupId === groupId)
  const contributedByPersonId = new Map(groupPeople.map((person) => [person.id, 0]))
  const includedContributions = contributions.filter((contribution) => isIncludedContribution(contribution, groupId, range))

  includedContributions.forEach((contribution) => {
    if (contributedByPersonId.has(contribution.personId)) {
      contributedByPersonId.set(contribution.personId, (contributedByPersonId.get(contribution.personId) ?? 0) + contribution.amountInCents)
    }
  })

  return {
    groupId,
    range,
    people: groupPeople.map((person) => ({
      personId: person.id,
      personName: person.name,
      isActive: person.isActive,
      contributedInCents: contributedByPersonId.get(person.id) ?? 0,
    })),
    includedContributionCount: includedContributions.length,
    totalContributionsInCents: [...contributedByPersonId.values()].reduce((total, amount) => total + amount, 0),
  }
}
