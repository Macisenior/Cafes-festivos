import { describe, expect, it } from 'vitest'
import { createGroupFinancialView } from '../../domain/financial-adapter'
import { createFirestoreV4GroupRecords, V4_GROUPS_COLLECTION } from './v4-group-records'

describe('createFirestoreV4GroupRecords', () => {
  it('preserva entidades V4 validadas, incluida la apertura heredada y las asignaciones', () => {
    const entities = {
      group: { id: 'general', name: 'Grupo prueba', isMainGroup: true, siteOptions: [] },
      people: [
        { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
        { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: true },
      ],
      contributions: [
        {
          id: 'v3-opening:general:ana',
          groupId: 'general',
          personId: 'ana',
          date: null,
          amountInCents: 1000,
          source: 'v3-opening' as const,
        },
        {
          id: 'contribution-1',
          groupId: 'general',
          personId: 'bea',
          date: '2026-08-01',
          amountInCents: 1000,
        },
      ],
      expenses: [
        {
          id: 'expense-1',
          groupId: 'general',
          date: '2026-08-02',
          concept: 'Prueba',
          siteName: 'Flap',
          totalInCents: 1000,
          participantIds: ['ana', 'bea'],
          distribution: { mode: 'igual' as const },
          allocations: [
            { personId: 'ana', amountInCents: 500 },
            { personId: 'bea', amountInCents: 500 },
          ],
        },
      ],
    }
    const records = createFirestoreV4GroupRecords(entities)

    expect(V4_GROUPS_COLLECTION).toBe('grupos_v4')
    expect(records.contributions).toHaveLength(2)
    expect(records.contributions[0]).toMatchObject({ source: 'v3-opening', date: null })
    expect(records.expenses[0].allocations).toEqual([
      { personId: 'ana', amountInCents: 500 },
      { personId: 'bea', amountInCents: 500 },
    ])
    expect(createGroupFinancialView(records).groupBalance.availableInCents).toBe(1000)
  })
})
