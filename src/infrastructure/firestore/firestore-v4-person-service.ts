import { deleteDoc, doc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import {
  createPersonWithOptionalInitialContribution,
  deactivatePerson,
  deletePerson,
  editPerson,
  reactivatePerson,
  type CreatePersonRequest,
  type CreatedPerson,
  type PersonEdition,
} from '../../domain/persons'
import type { Contribution, ContributionId, Expense, GroupId, Person } from '../../domain/entities'
import { V4_GROUPS_COLLECTION } from './v4-group-records'

export class FirestoreV4PersonPathError extends Error {}

export interface V4PersonLocation {
  rootCollection: typeof V4_GROUPS_COLLECTION
  groupId: GroupId
  personId: string
}

export interface V4PersonInitialContributionLocation {
  rootCollection: typeof V4_GROUPS_COLLECTION
  groupId: GroupId
  contributionId: ContributionId
}

export interface V4PersonPersistencePort {
  create(location: V4PersonLocation, person: Person): Promise<void>
  createWithInitialContribution(
    personLocation: V4PersonLocation,
    contributionLocation: V4PersonInitialContributionLocation,
    person: Person,
    contribution: Contribution,
  ): Promise<void>
  deactivate(location: V4PersonLocation): Promise<void>
  reactivate(location: V4PersonLocation): Promise<void>
  edit(location: V4PersonLocation, changes: Pick<Person, 'name' | 'phone'>): Promise<void>
  delete(location: V4PersonLocation): Promise<void>
}

function assertPathSegment(value: string, label: string): void {
  if (value.trim().length === 0 || value.includes('/')) {
    throw new FirestoreV4PersonPathError(`${label} debe ser un identificador, no una ruta.`)
  }
}

function createV4PersonLocation(groupId: GroupId, personId: string): V4PersonLocation {
  assertPathSegment(groupId, 'El identificador de grupo')
  assertPathSegment(personId, 'El identificador de persona')

  return { rootCollection: V4_GROUPS_COLLECTION, groupId, personId }
}

function createV4InitialContributionLocation(
  groupId: GroupId,
  contributionId: ContributionId,
): V4PersonInitialContributionLocation {
  assertPathSegment(groupId, 'El identificador de grupo')
  assertPathSegment(contributionId, 'El identificador de aportación')

  return { rootCollection: V4_GROUPS_COLLECTION, groupId, contributionId }
}

/** Persistencia limitada a personas y aportaciones iniciales bajo el mismo grupo V4. */
export class FirestoreV4PersonPersistence implements V4PersonPersistencePort {
  private readonly firestore: Firestore

  constructor(firestore: Firestore) {
    this.firestore = firestore
  }

  async create(location: V4PersonLocation, person: Person): Promise<void> {
    const batch = writeBatch(this.firestore)
    batch.set(doc(this.firestore, location.rootCollection, location.groupId, 'personas', location.personId), person)
    await batch.commit()
  }

  /** Un lote atómico evita que sobreviva una persona sin su aportación inicial si la escritura falla. */
  async createWithInitialContribution(
    personLocation: V4PersonLocation,
    contributionLocation: V4PersonInitialContributionLocation,
    person: Person,
    contribution: Contribution,
  ): Promise<void> {
    const batch = writeBatch(this.firestore)
    batch.set(doc(this.firestore, personLocation.rootCollection, personLocation.groupId, 'personas', personLocation.personId), person)
    batch.set(doc(this.firestore, contributionLocation.rootCollection, contributionLocation.groupId, 'aportaciones', contributionLocation.contributionId), contribution)
    await batch.commit()
  }

  async deactivate(location: V4PersonLocation): Promise<void> {
    await updateDoc(
      doc(this.firestore, location.rootCollection, location.groupId, 'personas', location.personId),
      { isActive: false },
    )
  }

  async reactivate(location: V4PersonLocation): Promise<void> {
    await updateDoc(
      doc(this.firestore, location.rootCollection, location.groupId, 'personas', location.personId),
      { isActive: true },
    )
  }

  async edit(location: V4PersonLocation, changes: Pick<Person, 'name' | 'phone'>): Promise<void> {
    await updateDoc(
      doc(this.firestore, location.rootCollection, location.groupId, 'personas', location.personId),
      changes,
    )
  }

  async delete(location: V4PersonLocation): Promise<void> {
    await deleteDoc(doc(this.firestore, location.rootCollection, location.groupId, 'personas', location.personId))
  }
}

/** Servicio V4 de personas: no guarda aportado, saldos ni modifica gastos. */
export class FirestoreV4PersonService {
  private readonly persistence: V4PersonPersistencePort

  constructor(persistence: V4PersonPersistencePort) {
    this.persistence = persistence
  }

  async create(
    people: readonly Person[],
    contributions: readonly Contribution[],
    request: CreatePersonRequest,
  ): Promise<CreatedPerson> {
    const created = createPersonWithOptionalInitialContribution(people, contributions, request)
    const personLocation = createV4PersonLocation(created.person.groupId, created.person.id)

    if (created.initialContribution === undefined) {
      await this.persistence.create(personLocation, created.person)
      return created
    }

    await this.persistence.createWithInitialContribution(
      personLocation,
      createV4InitialContributionLocation(created.initialContribution.groupId, created.initialContribution.id),
      created.person,
      created.initialContribution,
    )
    return created
  }

  async deactivate(people: readonly Person[], groupId: GroupId, personId: string): Promise<Person> {
    const location = createV4PersonLocation(groupId, personId)
    const person = deactivatePerson(people, groupId, personId)
    await this.persistence.deactivate(location)
    return person
  }

  async reactivate(people: readonly Person[], groupId: GroupId, personId: string): Promise<Person> {
    const location = createV4PersonLocation(groupId, personId)
    const person = reactivatePerson(people, groupId, personId)
    await this.persistence.reactivate(location)
    return person
  }

  async edit(people: readonly Person[], groupId: GroupId, edition: PersonEdition): Promise<Person> {
    const location = createV4PersonLocation(groupId, edition.id)
    const person = editPerson(people, groupId, edition)
    await this.persistence.edit(location, { name: person.name, phone: person.phone })
    return person
  }

  async delete(
    people: readonly Person[],
    contributions: readonly Contribution[],
    expenses: readonly Expense[],
    groupId: GroupId,
    personId: string,
  ): Promise<readonly Person[]> {
    const location = createV4PersonLocation(groupId, personId)
    const remainingPeople = deletePerson(people, contributions, expenses, groupId, personId)
    await this.persistence.delete(location)
    return remainingPeople
  }
}
