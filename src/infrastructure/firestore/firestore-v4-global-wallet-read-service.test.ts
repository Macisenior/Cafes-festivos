import { describe, expect, it } from 'vitest'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import { FirestoreV4GlobalWalletReadService, type V4GlobalWalletReadPort } from './firestore-v4-global-wallet-read-service'

const general: GroupFinancialEntities = { group: { id: 'general', name: 'General', isMainGroup: true, siteOptions: [] }, people: [], contributions: [{ id: 'c1', groupId: 'general', personId: 'ana', date: '2026-08-01', amountInCents: 100 }], expenses: [] }
const other: GroupFinancialEntities = { group: { id: 'otro', name: 'Otro', isMainGroup: false, siteOptions: [] }, people: [], contributions: [], expenses: [{ id: 'e1', groupId: 'otro', date: '2026-08-01', siteName: 'Flap', concept: 'Gasto', totalInCents: 40, participantIds: ['bea'], distribution: { mode: 'igual' }, allocations: [{ personId: 'bea', amountInCents: 40 }] }] }

class RecordingReader implements V4GlobalWalletReadPort {
  readonly readIds: string[] = []
  async listAvailableGroups() { return [general.group, other.group] }
  async readGroup(groupId: string) {
    this.readIds.push(groupId)
    if (groupId === 'general') return general
    if (groupId === 'otro') return other
    throw new Error('Grupo desconocido')
  }
}

describe('FirestoreV4GlobalWalletReadService', () => {
  it('lee exclusivamente todos los agregados V4 disponibles y delega el cálculo al adaptador', async () => {
    const reader = new RecordingReader()
    const result = await new FirestoreV4GlobalWalletReadService(reader).readCurrentWallet()

    expect(reader.readIds).toEqual(['general', 'otro'])
    expect(result.financialView.globalBalance.availableInCents).toBe(60)
    expect(result.financialView.groups.map((group) => group.groupId)).toEqual(['general', 'otro'])
    expect(result.entities.map((entities) => entities.group.id)).toEqual(['general', 'otro'])
  })
})
