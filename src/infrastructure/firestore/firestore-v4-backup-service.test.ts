import { describe, expect, it } from 'vitest'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import { createV4Backup } from '../../features/administracion/v4-backup'
import { FirestoreV4BackupService, type V4BackupPersistencePort, type V4BackupReadPort } from './firestore-v4-backup-service'

const entities: GroupFinancialEntities = { group: { id: 'general', name: 'General', isMainGroup: true, siteOptions: [] }, people: [], contributions: [], expenses: [] }
class Reader implements V4BackupReadPort { async listAvailableGroups() { return [{ id: 'general' }] }; async readGroup() { return entities } }
class Persistence implements V4BackupPersistencePort { calls = 0; async replaceAll() { this.calls += 1 } }

describe('FirestoreV4BackupService', () => {
  it('exporta solo agregados V4 y restaura únicamente después de validar el JSON completo', async () => {
    const persistence = new Persistence(); const service = new FirestoreV4BackupService(new Reader(), persistence)
    expect((await service.createBackup('2026-08-10T00:00:00.000Z')).groups).toEqual([entities])
    await service.restore(JSON.stringify(createV4Backup([entities], '2026-08-10T00:00:00.000Z')))
    expect(persistence.calls).toBe(1)
    await expect(service.restore('{}')).rejects.toThrow()
    expect(persistence.calls).toBe(1)
  })
})
