import { describe, expect, it } from 'vitest'
import type { Group } from '../../domain/entities'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import {
  FirestoreV4GroupDeletionService,
  FirestoreV4GroupPathError,
  FirestoreV4GroupService,
  type V4GroupDeletionReadPort,
  type V4GroupLocation,
  type V4GroupPersistencePort,
} from './firestore-v4-group-service'

class RecordingGroupPersistence implements V4GroupPersistencePort {
  readonly operations: Array<{ location: V4GroupLocation; group: Group }> = []
  readonly updates: Array<{ location: V4GroupLocation; name: string }> = []
  readonly deletions: V4GroupLocation[] = []

  async create(location: V4GroupLocation, group: Group): Promise<void> {
    this.operations.push({ location, group })
  }

  async updateName(location: V4GroupLocation, name: string): Promise<void> {
    this.updates.push({ location, name })
  }

  async delete(location: V4GroupLocation): Promise<void> {
    this.deletions.push(location)
  }
}

class GroupDeletionReader implements V4GroupDeletionReadPort {
  readonly readIds: string[] = []
  private readonly entities: GroupFinancialEntities

  constructor(entities: GroupFinancialEntities) {
    this.entities = entities
  }

  async readGroup(groupId: string): Promise<GroupFinancialEntities> {
    this.readIds.push(groupId)
    return this.entities
  }
}

const existingGroups: readonly Group[] = [
  { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] },
]

describe('FirestoreV4GroupService', () => {
  it('crea exclusivamente un documento de grupo estándar bajo grupos_v4/{groupId}', async () => {
    const persistence = new RecordingGroupPersistence()
    const service = new FirestoreV4GroupService(persistence)

    await service.createStandard(existingGroups, { id: 'v4-group-uuid', name: 'Viernes' })

    expect(persistence.operations).toEqual([{
      location: { rootCollection: 'grupos_v4', groupId: 'v4-group-uuid' },
      group: { id: 'v4-group-uuid', name: 'Viernes', isMainGroup: false, siteOptions: [] },
    }])
  })

  it('rechaza rutas V3 antes de persistir', async () => {
    const persistence = new RecordingGroupPersistence()
    const service = new FirestoreV4GroupService(persistence)

    await expect(service.createStandard(existingGroups, { id: 'grupos/general', name: 'No válido' }))
      .rejects.toBeInstanceOf(FirestoreV4GroupPathError)
    expect(persistence.operations).toEqual([])
  })

  it('actualiza exclusivamente el nombre del documento V4 y conserva su identificador', async () => {
    const persistence = new RecordingGroupPersistence()
    const service = new FirestoreV4GroupService(persistence)

    const group = await service.editName(existingGroups, 'general', 'Cafés del viernes')

    expect(group).toMatchObject({ id: 'general', name: 'Cafés del viernes', isMainGroup: true })
    expect(persistence.operations).toEqual([])
    expect(persistence.updates).toEqual([{
      location: { rootCollection: 'grupos_v4', groupId: 'general' },
      name: 'Cafés del viernes',
    }])
  })

  it('relee y elimina exclusivamente el documento de un grupo estándar vacío no activo', async () => {
    const persistence = new RecordingGroupPersistence()
    const reader = new GroupDeletionReader({
      group: { id: 'vacío', name: 'Vacío', isMainGroup: false, siteOptions: [] },
      people: [], contributions: [], expenses: [],
    })
    const service = new FirestoreV4GroupDeletionService(reader, persistence)

    await service.deleteEmptyGroup('vacío', 'general')

    expect(reader.readIds).toEqual(['vacío'])
    expect(persistence.deletions).toEqual([{ rootCollection: 'grupos_v4', groupId: 'vacío' }])
    expect(persistence.operations).toEqual([])
    expect(persistence.updates).toEqual([])
  })

  it('rechaza un grupo con historial sin emitir ningún borrado', async () => {
    const persistence = new RecordingGroupPersistence()
    const reader = new GroupDeletionReader({
      group: { id: 'con-datos', name: 'Con datos', isMainGroup: false, siteOptions: [] },
      people: [{ id: 'ana', groupId: 'con-datos', name: 'Ana', phone: '', isActive: true }],
      contributions: [], expenses: [],
    })
    const service = new FirestoreV4GroupDeletionService(reader, persistence)

    await expect(service.deleteEmptyGroup('con-datos', 'general')).rejects.toThrow('historial')
    expect(persistence.deletions).toEqual([])
  })
})
