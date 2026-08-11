import { deleteDoc, doc, runTransaction, updateDoc, type Firestore } from 'firebase/firestore'
import {
  assertGroupCanBeDeleted,
  createStandardGroup,
  editGroupName,
  getGroupDeletionEligibility,
  type GroupDeletionEligibility,
  type NewStandardGroupInput,
} from '../../domain/groups'
import type { Group, GroupId } from '../../domain/entities'
import { V4_GROUPS_COLLECTION } from './v4-group-records'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'

export class FirestoreV4GroupPathError extends Error {}
export class FirestoreV4GroupConflictError extends Error {}

export interface V4GroupLocation {
  rootCollection: typeof V4_GROUPS_COLLECTION
  groupId: GroupId
}

export interface V4GroupPersistencePort {
  create(location: V4GroupLocation, group: Group): Promise<void>
  updateName(location: V4GroupLocation, name: string): Promise<void>
  delete(location: V4GroupLocation): Promise<void>
}

export function createV4GroupLocation(groupId: GroupId): V4GroupLocation {
  if (groupId.trim().length === 0 || groupId.includes('/')) {
    throw new FirestoreV4GroupPathError('El identificador de grupo debe ser un identificador V4, no una ruta.')
  }

  return { rootCollection: V4_GROUPS_COLLECTION, groupId }
}

/** Persistencia limitada a la creación de un documento bajo grupos_v4/{groupId}. */
export class FirestoreV4GroupPersistence implements V4GroupPersistencePort {
  private readonly firestore: Firestore

  constructor(firestore: Firestore) {
    this.firestore = firestore
  }

  async create(location: V4GroupLocation, group: Group): Promise<void> {
    const reference = doc(this.firestore, location.rootCollection, location.groupId)
    await runTransaction(this.firestore, async (transaction) => {
      const existing = await transaction.get(reference)
      if (existing.exists()) {
        throw new FirestoreV4GroupConflictError('Ya existe un grupo V4 con ese identificador.')
      }
      transaction.set(reference, group)
    })
  }

  async updateName(location: V4GroupLocation, name: string): Promise<void> {
    await updateDoc(doc(this.firestore, location.rootCollection, location.groupId), { name })
  }

  async delete(location: V4GroupLocation): Promise<void> {
    await deleteDoc(doc(this.firestore, location.rootCollection, location.groupId))
  }
}

/** Servicio de alta de grupos V4: no crea personas, aportaciones, gastos ni subcolecciones. */
export class FirestoreV4GroupService {
  private readonly persistence: V4GroupPersistencePort

  constructor(persistence: V4GroupPersistencePort) {
    this.persistence = persistence
  }

  async createStandard(groups: readonly Group[], input: NewStandardGroupInput): Promise<Group> {
    const location = createV4GroupLocation(input.id)
    const group = createStandardGroup(groups, input)
    await this.persistence.create(location, group)
    return group
  }

  async editName(groups: readonly Group[], groupId: GroupId, name: string): Promise<Group> {
    const location = createV4GroupLocation(groupId)
    const group = editGroupName(groups, groupId, name)
    await this.persistence.updateName(location, group.name)
    return group
  }
}

export interface V4GroupDeletionReadPort {
  readGroup(groupId: GroupId): Promise<GroupFinancialEntities>
}

/**
 * Borra exclusivamente el documento raíz de un grupo V4 tras releer su
 * agregado y comprobar que el esquema V4 actual no contiene datos relevantes.
 */
export class FirestoreV4GroupDeletionService {
  private readonly reader: V4GroupDeletionReadPort
  private readonly persistence: V4GroupPersistencePort

  constructor(reader: V4GroupDeletionReadPort, persistence: V4GroupPersistencePort) {
    this.reader = reader
    this.persistence = persistence
  }

  async inspect(groupId: GroupId, activeGroupId: GroupId): Promise<GroupDeletionEligibility> {
    const location = createV4GroupLocation(groupId)
    const entities = await this.reader.readGroup(location.groupId)
    return getGroupDeletionEligibility(entities, activeGroupId)
  }

  async deleteEmptyGroup(groupId: GroupId, activeGroupId: GroupId): Promise<void> {
    const location = createV4GroupLocation(groupId)
    const entities = await this.reader.readGroup(location.groupId)
    assertGroupCanBeDeleted(entities, activeGroupId)
    await this.persistence.delete(location)
  }
}
