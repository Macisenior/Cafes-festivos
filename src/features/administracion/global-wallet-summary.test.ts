import { describe, expect, it } from 'vitest'
import { createGlobalFinancialView } from '../../domain/financial-adapter'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import { createGlobalWalletSummary } from './global-wallet-summary'

const groupEntities: readonly GroupFinancialEntities[] = [
  {
    group: { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] },
    people: [],
    contributions: [{ id: 'c1', groupId: 'general', personId: 'ana', date: '2026-08-01', amountInCents: 392797 }],
    expenses: [{ id: 'e1', groupId: 'general', date: '2026-08-01', siteName: 'Flap', concept: 'Gasto', totalInCents: 385120, participantIds: ['ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'ana', amountInCents: 385120 }] }],
  },
  {
    group: { id: 'solo-aportaciones', name: 'Solo aportaciones', isMainGroup: false, siteOptions: [] }, people: [],
    contributions: [{ id: 'c2', groupId: 'solo-aportaciones', personId: 'bea', date: '2026-08-01', amountInCents: 500 }], expenses: [],
  },
  {
    group: { id: 'solo-gastos', name: 'Solo gastos', isMainGroup: false, siteOptions: [] }, people: [], contributions: [],
    expenses: [{ id: 'e2', groupId: 'solo-gastos', date: '2026-08-01', siteName: 'Flap', concept: 'Gasto', totalInCents: 200, participantIds: ['bea'], distribution: { mode: 'igual' }, allocations: [{ personId: 'bea', amountInCents: 200 }] }],
  },
  { group: { id: 'vacío', name: 'Vacío', isMainGroup: false, siteOptions: [] }, people: [], contributions: [], expenses: [] },
]

describe('Resumen global del monedero', () => {
  it('usa el motor para saldo = aportaciones - gastos y total global exacto en céntimos', () => {
    const financialView = createGlobalFinancialView(groupEntities)
    const summary = createGlobalWalletSummary(groupEntities.map((entities) => entities.group), financialView, 'general')

    expect(summary.groups).toEqual([
      expect.objectContaining({ groupId: 'general', balanceInCents: 7677, isActiveGroup: true }),
      expect.objectContaining({ groupId: 'solo-aportaciones', balanceInCents: 500 }),
      expect.objectContaining({ groupId: 'solo-gastos', balanceInCents: -200 }),
      expect.objectContaining({ groupId: 'vacío', balanceInCents: 0 }),
    ])
    expect(summary.totalWalletInCents).toBe(7977)
    expect(summary.sumOfGroupBalancesInCents).toBe(7977)
    expect(summary.isConsistent).toBe(true)
  })

  it('no altera el resultado financiero al cambiar únicamente el grupo activo', () => {
    const financialView = createGlobalFinancialView(groupEntities)
    const general = createGlobalWalletSummary(groupEntities.map((entities) => entities.group), financialView, 'general')
    const other = createGlobalWalletSummary(groupEntities.map((entities) => entities.group), financialView, 'solo-gastos')

    expect(other.totalWalletInCents).toBe(general.totalWalletInCents)
    expect(other.groups.map((group) => group.balanceInCents)).toEqual(general.groups.map((group) => group.balanceInCents))
  })

  it('permite un estado vacío sin grupos', () => {
    const financialView = createGlobalFinancialView([])
    expect(createGlobalWalletSummary([], financialView, 'general')).toMatchObject({ groups: [], totalWalletInCents: 0, isConsistent: true })
  })
})
