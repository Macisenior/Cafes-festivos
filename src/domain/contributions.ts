import type { MovementDate } from './dates'
import type { Contribution, ContributionId, GroupId, Person } from './entities'
import type { AmountInCents } from './money'

export class ContributionDomainError extends Error {}

export interface NewContributionInput {
  id: ContributionId
  groupId: GroupId
  personId: string
  amountInCents: AmountInCents
  date: MovementDate
}

export interface ContributionEdition {
  id: ContributionId
  amountInCents: AmountInCents
  date: MovementDate
}

function assertStableId(id: string): void {
  if (id.trim().length === 0) {
    throw new ContributionDomainError('Una aportación necesita un identificador estable.')
  }
}

function assertOperationalAmount(amountInCents: AmountInCents): void {
  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    throw new ContributionDomainError('El importe de una nueva aportación debe ser un número positivo de céntimos.')
  }
}

function assertMovementDate(date: MovementDate): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ContributionDomainError('La fecha de una aportación debe usar el formato YYYY-MM-DD.')
  }

  const [year, month, day] = date.split('-').map(Number)
  const parsedDate = new Date(Date.UTC(year, month - 1, day))

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new ContributionDomainError('La fecha de una aportación debe ser una fecha real.')
  }
}

function assertActivePerson(people: readonly Person[], groupId: GroupId, personId: string): void {
  const person = people.find((candidate) => candidate.id === personId && candidate.groupId === groupId)

  if (person === undefined) {
    throw new ContributionDomainError('La persona no pertenece al grupo de la aportación.')
  }

  if (!person.isActive) {
    throw new ContributionDomainError('No se puede registrar una aportación nueva para una persona inactiva.')
  }
}

/** Crea el único tipo de entrada de dinero V4: un movimiento de aportación. */
export function createContribution(
  people: readonly Person[],
  contributions: readonly Contribution[],
  input: NewContributionInput,
): Contribution {
  assertStableId(input.id)
  assertOperationalAmount(input.amountInCents)
  assertMovementDate(input.date)
  assertActivePerson(people, input.groupId, input.personId)

  if (contributions.some((contribution) => contribution.id === input.id)) {
    throw new ContributionDomainError('Ya existe una aportación con ese identificador.')
  }

  return {
    id: input.id,
    groupId: input.groupId,
    personId: input.personId,
    amountInCents: input.amountInCents,
    date: input.date,
    source: 'user',
  }
}

/** La aportación inicial de una persona usa exactamente la misma regla V4. */
export function createInitialContribution(
  people: readonly Person[],
  contributions: readonly Contribution[],
  input: NewContributionInput,
): Contribution {
  return createContribution(people, contributions, input)
}

/** Añadir efectivo es otra entrada de dinero y usa exactamente la misma regla V4. */
export function addCashContribution(
  people: readonly Person[],
  contributions: readonly Contribution[],
  input: NewContributionInput,
): Contribution {
  return createContribution(people, contributions, input)
}

/** Edita importe y fecha sin alterar identidad, persona, grupo ni otros movimientos. */
export function editContribution(
  contributions: readonly Contribution[],
  edition: ContributionEdition,
): readonly Contribution[] {
  assertStableId(edition.id)
  assertOperationalAmount(edition.amountInCents)
  assertMovementDate(edition.date)

  let wasFound = false
  const updatedContributions = contributions.map((contribution) => {
    if (contribution.id !== edition.id) return contribution

    wasFound = true
    return {
      ...contribution,
      amountInCents: edition.amountInCents,
      date: edition.date,
    }
  })

  if (!wasFound) {
    throw new ContributionDomainError('No existe la aportación que se quiere editar.')
  }

  return updatedContributions
}

/** Elimina un único movimiento identificado, sin modificar personas ni acumulados. */
export function deleteContribution(
  contributions: readonly Contribution[],
  contributionId: ContributionId,
): readonly Contribution[] {
  assertStableId(contributionId)
  const remainingContributions = contributions.filter((contribution) => contribution.id !== contributionId)

  if (remainingContributions.length === contributions.length) {
    throw new ContributionDomainError('No existe la aportación que se quiere eliminar.')
  }

  return remainingContributions
}

/** Permite mantener en lectura movimientos heredados firmados, sin crearlos de nuevo. */
export function isValidHistoricalContribution(contribution: Contribution): boolean {
  return (
    contribution.source === 'v3-opening' &&
    Number.isSafeInteger(contribution.amountInCents) &&
    contribution.date === null
  )
}
