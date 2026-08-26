import { describe, expect, it } from 'vitest'
import type { Expense, Person } from '../../domain/entities'
import { createExpenseShareCardData } from './expense-share-card'

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: false },
]
const expense: Expense = {
  id: 'expense-1', groupId: 'general', date: '2026-08-25', siteName: 'Lydo', concept: 'Cena del grupo', totalInCents: 1001,
  participantIds: ['ana', 'bea'], distribution: { mode: 'consumiciones', consumptionsByPersonId: { ana: 2, bea: 1 } },
  allocations: [{ personId: 'ana', amountInCents: 667 }, { personId: 'bea', amountInCents: 334 }],
}

describe('tarjeta de imagen de gasto', () => {
  it('prepara solo el contenido del gasto con sus asignaciones finales existentes', () => {
    expect(createExpenseShareCardData('Cafés Semanal', expense, people)).toEqual({
      groupName: 'Cafés Semanal', siteName: 'Lydo', concept: 'Cena del grupo', formattedDate: '25/08/2026', formattedTotal: '10,01 €', distributionLabel: 'Consumiciones',
      allocations: [{ personId: 'ana', personName: 'Ana', amountInCents: 667 }, { personId: 'bea', personName: 'Bea', amountInCents: 334 }],
    })
  })
})