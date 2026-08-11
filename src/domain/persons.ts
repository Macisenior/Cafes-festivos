import { createInitialContribution, type NewContributionInput } from './contributions'
import type { Contribution, Expense, GroupId, Person } from './entities'

export class PersonDomainError extends Error {}

export interface NewPersonInput {
  id: string
  groupId: GroupId
  name: string
  phone: string
}

export interface CreatePersonRequest {
  person: NewPersonInput
  initialContribution?: NewContributionInput
}

export interface CreatedPerson {
  person: Person
  initialContribution?: Contribution
}

export interface PersonEdition {
  id: string
  name: string
  phone: string
}

function assertPersonId(id: string): void {
  if (id.trim().length === 0) throw new PersonDomainError('Una persona necesita un identificador estable.')
}

function assertName(name: string): void {
  if (name.trim().length === 0) throw new PersonDomainError('El nombre de la persona es obligatorio.')
}

/** Crea solo los datos propios de una persona; nunca contiene acumulados financieros. */
export function createPerson(people: readonly Person[], input: NewPersonInput): Person {
  assertPersonId(input.id)
  assertName(input.name)

  if (people.some((person) => person.groupId === input.groupId && person.id === input.id)) {
    throw new PersonDomainError('Ya existe una persona con ese identificador en el grupo.')
  }

  return {
    id: input.id,
    groupId: input.groupId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    isActive: true,
  }
}

/**
 * Compone un alta y, opcionalmente, una aportación inicial. Esta última usa
 * literalmente la misma regla que Añadir efectivo: createInitialContribution.
 */
export function createPersonWithOptionalInitialContribution(
  people: readonly Person[],
  contributions: readonly Contribution[],
  request: CreatePersonRequest,
): CreatedPerson {
  const person = createPerson(people, request.person)

  if (request.initialContribution === undefined) return { person }

  if (
    request.initialContribution.groupId !== person.groupId
    || request.initialContribution.personId !== person.id
  ) {
    throw new PersonDomainError('La aportación inicial debe pertenecer a la nueva persona y a su grupo.')
  }

  return {
    person,
    initialContribution: createInitialContribution([...people, person], contributions, request.initialContribution),
  }
}

/** Baja segura: conserva la identidad y todo el historial financiero de la persona. */
export function deactivatePerson(
  people: readonly Person[],
  groupId: GroupId,
  personId: string,
): Person {
  const person = people.find((candidate) => candidate.groupId === groupId && candidate.id === personId)

  if (person === undefined) throw new PersonDomainError('La persona no pertenece al grupo activo.')

  return { ...person, isActive: false }
}

/** Reactivación segura: recupera a la persona para operaciones futuras sin alterar su historial. */
export function reactivatePerson(
  people: readonly Person[],
  groupId: GroupId,
  personId: string,
): Person {
  const person = people.find((candidate) => candidate.groupId === groupId && candidate.id === personId)

  if (person === undefined) throw new PersonDomainError('La persona no pertenece al grupo activo.')
  if (person.isActive) throw new PersonDomainError('La persona ya está activa.')

  return { ...person, isActive: true }
}

/** Edita exclusivamente datos propios no financieros y conserva el estado de actividad. */
export function editPerson(
  people: readonly Person[],
  groupId: GroupId,
  edition: PersonEdition,
): Person {
  assertPersonId(edition.id)
  assertName(edition.name)
  const person = people.find((candidate) => candidate.groupId === groupId && candidate.id === edition.id)

  if (person === undefined) throw new PersonDomainError('La persona no pertenece al grupo activo.')

  return {
    ...person,
    name: edition.name.trim(),
    phone: edition.phone.trim(),
  }
}

/**
 * Comprueba todas las referencias financieras V4 actuales de la persona dentro
 * de su grupo. Cualquier aportación (incluida una apertura heredada),
 * participante o asignación final bloquea el borrado físico.
 */
export function canPhysicallyDeletePerson(
  people: readonly Person[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
  groupId: GroupId,
  personId: string,
): boolean {
  const personExists = people.some((person) => person.groupId === groupId && person.id === personId)
  if (!personExists) return false

  const hasContribution = contributions.some(
    (contribution) => contribution.groupId === groupId && contribution.personId === personId,
  )
  const hasExpenseReference = expenses.some(
    (expense) => expense.groupId === groupId
      && (expense.participantIds.includes(personId) || expense.allocations.some((allocation) => allocation.personId === personId)),
  )

  return !hasContribution && !hasExpenseReference
}

/** Elimina exclusivamente una persona sin referencias financieras del grupo activo. */
export function deletePerson(
  people: readonly Person[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
  groupId: GroupId,
  personId: string,
): readonly Person[] {
  const person = people.find((candidate) => candidate.groupId === groupId && candidate.id === personId)
  if (person === undefined) throw new PersonDomainError('La persona no pertenece al grupo activo.')

  if (!canPhysicallyDeletePerson(people, contributions, expenses, groupId, personId)) {
    throw new PersonDomainError('No se puede borrar una persona con historial financiero.')
  }

  return people.filter((candidate) => candidate !== person)
}
