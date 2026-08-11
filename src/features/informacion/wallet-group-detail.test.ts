import { describe, expect, it } from 'vitest'
import { createGroupFinancialView } from '../../domain/financial-adapter'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import type { GlobalWalletGroupItem } from '../administracion/global-wallet-summary'
import { createWalletGroupDetail, toggleWalletGroupDetail } from './wallet-group-detail'

const group: Group = { id: 'cafes', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] }
const people: readonly Person[] = [
  { id: 'pepe', groupId: 'cafes', name: 'Pepe', phone: '', isActive: true },
  { id: 'ana', groupId: 'cafes', name: 'Ana', phone: '', isActive: false },
]
const contributions: readonly Contribution[] = [
  { id: 'inicio', groupId: 'cafes', personId: 'pepe', date: null, amountInCents: 500, source: 'v3-opening' },
  { id: 'aporte-fechado', groupId: 'cafes', personId: 'pepe', date: '2026-08-08', amountInCents: 1200, source: 'user' },
]
const expenses: readonly Expense[] = [
  { id: 'gasto-reciente', groupId: 'cafes', date: '2026-08-09', siteName: 'Lydo', concept: 'Cafés', totalInCents: 900, participantIds: ['pepe', 'ana'], distribution: { mode: 'igual' }, allocations: [{ personId: 'pepe', amountInCents: 450 }, { personId: 'ana', amountInCents: 450 }] },
]
const entities = { group, people, contributions, expenses }
const item: GlobalWalletGroupItem = { groupId: 'cafes', groupName: group.name, balanceInCents: 800, isActiveGroup: true }

describe('detalle de grupo de Mi Monedero', () => {
  it('abre/cierra una tarjeta y mantiene una sola tarjeta expandida', () => {
    expect(toggleWalletGroupDetail(null, 'cafes')).toBe('cafes')
    expect(toggleWalletGroupDetail('cafes', 'cafes')).toBeNull()
    expect(toggleWalletGroupDetail('cafes', 'viernes')).toBe('viernes')
  })

  it('muestra saldo personal solo cuando la persona pertenece al grupo y conserva el saldo derivado', () => {
    const view = createGroupFinancialView(entities)
    const detail = createWalletGroupDetail(item, entities, view, 'pepe')

    expect(detail.balanceInCents).toBe(800)
    expect(detail.selectedPersonBalanceInCents).toBe(1250)
    expect(detail.activePeopleCount).toBe(1)
    expect(createWalletGroupDetail(item, entities, view, 'persona-otro-grupo').selectedPersonBalanceInCents).toBeNull()
  })

  it('usa el último movimiento fechado y excluye Inicio como última aportación', () => {
    const detail = createWalletGroupDetail(item, entities, createGroupFinancialView(entities), 'pepe')

    expect(detail.latestMovement).toMatchObject({ id: 'gasto-reciente', kind: 'expense', title: 'Lydo · Cafés', amountInCents: 900 })
    expect(detail.latestContribution).toMatchObject({ id: 'aporte-fechado', kind: 'contribution', date: '2026-08-08', amountInCents: 1200 })
  })

  it('muestra estado vacío cuando no existen movimientos fechados', () => {
    const emptyEntities = { group, people: [], contributions: [], expenses: [] }
    const detail = createWalletGroupDetail(item, emptyEntities, createGroupFinancialView(emptyEntities), null)

    expect(detail).toMatchObject({ activePeopleCount: 0, latestMovement: null, latestContribution: null, selectedPersonBalanceInCents: null })
  })
})
