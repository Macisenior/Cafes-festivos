import { deleteDoc, doc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import {
  addCashContribution,
  createContribution,
  deleteContribution,
  editContribution,
  type ContributionEdition,
  type NewContributionInput,
} from '../../domain/contributions'
import type { Contribution, ContributionId, GroupId, Person } from '../../domain/entities'
import { V4_GROUPS_COLLECTION } from './v4-group-records'

export class FirestoreV4ContributionPathError extends Error {}

export interface V4ContributionLocation {
  rootCollection: typeof V4_GROUPS_COLLECTION
  groupId: GroupId
  contributionId: ContributionId
}

export interface V4ContributionPersistencePort {
  create(location: V4ContributionLocation, contribution: Contribution): Promise<void>
  update(
    location: V4ContributionLocation,
    changes: Pick<Contribution, 'amountInCents' | 'date'>,
  ): Promise<void>
  delete(location: V4ContributionLocation): Promise<void>
}

function assertPathSegment(value: string, label: string): void {
  if (value.trim().length === 0 || value.includes('/')) {
    throw new FirestoreV4ContributionPathError(`${label} debe ser un identificador, no una ruta.`)
  }
}

function createV4ContributionLocation(
  groupId: GroupId,
  contributionId: ContributionId,
): V4ContributionLocation {
  assertPathSegment(groupId, 'El identificador de grupo')
  assertPathSegment(contributionId, 'El identificador de aportación')

  return {
    rootCollection: V4_GROUPS_COLLECTION,
    groupId,
    contributionId,
  }
}

/** Adaptador de escritura Firestore, limitado a grupos_v4/{grupo}/aportaciones/{aportación}. */
export class FirestoreV4ContributionPersistence implements V4ContributionPersistencePort {
  private readonly firestore: Firestore

  constructor(firestore: Firestore) {
    this.firestore = firestore
  }

  async create(location: V4ContributionLocation, contribution: Contribution): Promise<void> {
    await setDoc(this.reference(location), contribution)
  }

  async update(
    location: V4ContributionLocation,
    changes: Pick<Contribution, 'amountInCents' | 'date'>,
  ): Promise<void> {
    await updateDoc(this.reference(location), changes)
  }

  async delete(location: V4ContributionLocation): Promise<void> {
    await deleteDoc(this.reference(location))
  }

  private reference(location: V4ContributionLocation) {
    return doc(
      this.firestore,
      location.rootCollection,
      location.groupId,
      'aportaciones',
      location.contributionId,
    )
  }
}

/**
 * Servicio de aplicación para aportaciones. Compone las reglas puras del
 * dominio con una persistencia limitada a documentos V4 de aportaciones.
 */
export class FirestoreV4ContributionService {
  private readonly persistence: V4ContributionPersistencePort

  constructor(persistence: V4ContributionPersistencePort) {
    this.persistence = persistence
  }

  async create(
    people: readonly Person[],
    contributions: readonly Contribution[],
    input: NewContributionInput,
  ): Promise<Contribution> {
    const location = createV4ContributionLocation(input.groupId, input.id)
    const contribution = createContribution(people, contributions, input)

    await this.persistence.create(location, contribution)
    return contribution
  }

  /** Variante para Añadir efectivo; conserva la única regla de dominio de aportaciones. */
  async createCash(
    people: readonly Person[],
    contributions: readonly Contribution[],
    input: NewContributionInput,
  ): Promise<Contribution> {
    const location = createV4ContributionLocation(input.groupId, input.id)
    const contribution = addCashContribution(people, contributions, input)

    await this.persistence.create(location, contribution)
    return contribution
  }

  async edit(
    contributions: readonly Contribution[],
    edition: ContributionEdition,
  ): Promise<readonly Contribution[]> {
    const updatedContributions = editContribution(contributions, edition)
    const updatedContribution = updatedContributions.find((contribution) => contribution.id === edition.id)

    if (updatedContribution === undefined) {
      throw new Error('La aportación editada no se ha encontrado tras la validación de dominio.')
    }

    const location = createV4ContributionLocation(updatedContribution.groupId, updatedContribution.id)
    await this.persistence.update(location, {
      amountInCents: updatedContribution.amountInCents,
      date: updatedContribution.date,
    })

    return updatedContributions
  }

  async delete(
    contributions: readonly Contribution[],
    contributionId: ContributionId,
  ): Promise<readonly Contribution[]> {
    const contribution = contributions.find((candidate) => candidate.id === contributionId)
    const remainingContributions = deleteContribution(contributions, contributionId)

    if (contribution === undefined) {
      throw new Error('La aportación eliminada no se ha encontrado tras la validación de dominio.')
    }

    await this.persistence.delete(createV4ContributionLocation(contribution.groupId, contribution.id))
    return remainingContributions
  }
}
