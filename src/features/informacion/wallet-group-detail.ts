import type { GroupFinancialEntities, GroupFinancialView } from '../../domain/financial-adapter'
import type { GroupId } from '../../domain/entities'
import { createOperationalHistory } from '../operativa/operational-history'
import type { GlobalWalletGroupItem } from '../administracion/global-wallet-summary'

export interface WalletGroupMovementSummary {
  id: string
  date: string
  kind: 'contribution' | 'expense'
  title: string
  amountInCents: number
}

export interface WalletGroupDetail {
  balanceInCents: number
  selectedPersonBalanceInCents: number | null
  activePeopleCount: number
  latestMovement: WalletGroupMovementSummary | null
  latestContribution: WalletGroupMovementSummary | null
}

/**
 * Prepara el detalle de consulta de una tarjeta del monedero a partir de la
 * misma lectura global V4 y de los balances ya derivados por el motor.
 */
export function createWalletGroupDetail(
  group: GlobalWalletGroupItem,
  entities: GroupFinancialEntities,
  financialView: GroupFinancialView,
  selectedPersonId: string | null,
): WalletGroupDetail {
  const history = createOperationalHistory(
    group.groupId,
    entities.people,
    entities.contributions,
    entities.expenses,
  )
  const toSummary = (entry: (typeof history)[number]): WalletGroupMovementSummary | null => {
    if (entry.date === null) return null
    return entry.kind === 'contribution'
      ? { id: entry.id, date: entry.date, kind: entry.kind, title: 'Aportación', amountInCents: entry.amountInCents }
      : { id: entry.id, date: entry.date, kind: entry.kind, title: `${entry.siteName} · ${entry.concept}`, amountInCents: entry.amountInCents }
  }
  const latestMovement = history.map(toSummary).find((entry): entry is WalletGroupMovementSummary => entry !== null) ?? null
  const latestContribution = history
    .filter((entry) => entry.kind === 'contribution')
    .map(toSummary)
    .find((entry): entry is WalletGroupMovementSummary => entry !== null) ?? null
  const selectedPersonBalance = selectedPersonId === null
    ? undefined
    : financialView.personBalances.find((balance) => balance.personId === selectedPersonId)

  return {
    balanceInCents: group.balanceInCents,
    selectedPersonBalanceInCents: selectedPersonBalance?.availableInCents ?? null,
    activePeopleCount: entities.people.filter((person) => person.groupId === group.groupId && person.isActive).length,
    latestMovement,
    latestContribution,
  }
}

/** Mantiene una sola tarjeta desplegada y permite cerrarla al pulsar de nuevo. */
export function toggleWalletGroupDetail(openGroupId: GroupId | null, groupId: GroupId): GroupId | null {
  return openGroupId === groupId ? null : groupId
}
