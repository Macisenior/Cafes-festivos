import { describe, expect, it } from 'vitest'
import { createGroupFinancialView } from '../../domain/financial-adapter'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import {
  QuickExpenseError,
  createQuickExpenseWhatsAppMessage,
  createQuickExpenseWhatsAppUrl,
  prepareQuickExpenseDraft,
} from './quick-expense'

const group: Group = { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [{ id: 'flap', name: 'Flap' }] }
const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '600000001', isActive: true },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: false },
  { id: 'other', groupId: 'other', name: 'Other', phone: '600000002', isActive: true },
]
const contributions: readonly Contribution[] = [{ id: 'c1', groupId: 'general', personId: 'ana', date: '2026-08-10', amountInCents: 2000 }]
const expenses: readonly Expense[] = [{ id: 'e1', groupId: 'general', date: '2026-08-10', siteName: 'Flap', concept: 'Café', totalInCents: 500, participantIds: ['ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 500 }] }]

describe('Gasto rápido', () => {
  it('prepara el mensaje V3 equivalente sin modificar movimientos ni balances', () => {
    const before = createGroupFinancialView({ group, people, contributions, expenses })
    const draft = prepareQuickExpenseDraft(group, people, { groupId: 'general', siteName: 'Flap', amountInCents: 1234, reportedPayerPersonId: 'ana', participantIds: ['ana'] })
    const after = createGroupFinancialView({ group, people, contributions, expenses })

    expect(draft).toMatchObject({ groupId: 'general', amountInCents: 1234, reportedPayerName: 'Ana', participantNames: ['Ana'] })
    expect(createQuickExpenseWhatsAppMessage(draft)).toContain('💳 Pagado por: Ana')
    expect(createQuickExpenseWhatsAppMessage(draft)).toContain('👥 Ana')
    expect(createQuickExpenseWhatsAppUrl(draft, '34600123456')).toContain('https://wa.me/34600123456?text=')
    expect(createQuickExpenseWhatsAppUrl(draft, '')).toBeNull()
    expect(after).toEqual(before)
    expect(contributions).toHaveLength(1)
    expect(expenses).toHaveLength(1)
  })

  it('solo acepta personas activas del grupo activo y participantes no repetidos', () => {
    const input = { groupId: 'general', siteName: 'Flap', amountInCents: 100, reportedPayerPersonId: '', participantIds: ['bea'] }
    expect(() => prepareQuickExpenseDraft(group, people, input)).toThrow(QuickExpenseError)
    expect(() => prepareQuickExpenseDraft(group, people, { ...input, participantIds: ['ana', 'ana'] })).toThrow(QuickExpenseError)
    expect(() => prepareQuickExpenseDraft(group, people, { ...input, participantIds: ['other'] })).toThrow(QuickExpenseError)
  })

})
