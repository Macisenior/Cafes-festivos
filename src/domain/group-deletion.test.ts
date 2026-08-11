import { describe, expect, it } from 'vitest'
import type { GroupFinancialEntities } from './financial-adapter'
import { assertGroupCanBeDeleted, getGroupDeletionEligibility, GroupDomainError } from './groups'

function entities(overrides: Partial<GroupFinancialEntities> = {}): GroupFinancialEntities {
  return {
    group: { id: 'vacio', name: 'Vacío', isMainGroup: false, siteOptions: [] },
    people: [],
    contributions: [],
    expenses: [],
    ...overrides,
  }
}

describe('borrado controlado de grupos V4', () => {
  it('permite un grupo estándar completamente vacío y no activo', () => {
    expect(getGroupDeletionEligibility(entities(), 'general')).toEqual({ canDelete: true, reason: null })
  })

  it('rechaza el grupo principal y general aunque estén vacíos', () => {
    expect(getGroupDeletionEligibility(entities({ group: { id: 'general', name: 'General', isMainGroup: true, siteOptions: [] } }), 'otro').canDelete).toBe(false)
    expect(getGroupDeletionEligibility(entities({ group: { id: 'otro', name: 'Principal', isMainGroup: true, siteOptions: [] } }), 'general').canDelete).toBe(false)
  })

  it('rechaza el grupo activo', () => {
    expect(getGroupDeletionEligibility(entities(), 'vacio')).toMatchObject({ canDelete: false, reason: 'No se puede borrar el grupo activo.' })
  })

  it('rechaza personas, aportaciones y gastos sin borrar ninguno de sus datos', () => {
    const withPerson = entities({ people: [{ id: 'ana', groupId: 'vacio', name: 'Ana', phone: '', isActive: true }] })
    const withContribution = entities({ contributions: [{ id: 'c', groupId: 'vacio', personId: 'ana', amountInCents: 100, date: '2026-08-10', source: 'user' }] })
    const withExpense = entities({ expenses: [{
      id: 'g', groupId: 'vacio', date: '2026-08-10', concept: 'Cena', siteName: 'Sitio', totalInCents: 100,
      participantIds: ['ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 100 }],
    }] })

    expect(getGroupDeletionEligibility(withPerson, 'general').canDelete).toBe(false)
    expect(getGroupDeletionEligibility(withContribution, 'general').canDelete).toBe(false)
    expect(getGroupDeletionEligibility(withExpense, 'general').canDelete).toBe(false)
    expect(() => assertGroupCanBeDeleted(withExpense, 'general')).toThrow(GroupDomainError)
    expect(withContribution.contributions).toHaveLength(1)
    expect(withExpense.expenses[0].allocations).toEqual([{ personId: 'ana', amountInCents: 100 }])
  })

  it('aísla referencias de otros grupos al comprobar el agregado objetivo', () => {
    const target = entities({
      contributions: [{ id: 'c-otro', groupId: 'otro', personId: 'ana', amountInCents: 100, date: '2026-08-10', source: 'user' }],
    })

    expect(getGroupDeletionEligibility(target, 'general')).toEqual({ canDelete: true, reason: null })
  })
})
