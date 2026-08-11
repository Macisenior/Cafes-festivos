import type { GlobalFinancialView } from '../../domain/financial-adapter'
import type { Group, GroupId } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'

export interface GlobalWalletGroupItem {
  groupId: GroupId
  groupName: string
  balanceInCents: AmountInCents
  isActiveGroup: boolean
}

export interface GlobalWalletSummary {
  groups: readonly GlobalWalletGroupItem[]
  totalWalletInCents: AmountInCents
  sumOfGroupBalancesInCents: AmountInCents
  isConsistent: boolean
}

/** Presenta los balances ya calculados por el motor, sin repetir cálculos financieros. */
export function createGlobalWalletSummary(
  groups: readonly Group[],
  financialView: GlobalFinancialView,
  activeGroupId: GroupId,
): GlobalWalletSummary {
  const balanceByGroupId = new Map(financialView.groups.map((groupView) => [groupView.groupId, groupView.groupBalance.availableInCents]))
  const items = groups.map((group) => ({
    groupId: group.id,
    groupName: group.name,
    balanceInCents: balanceByGroupId.get(group.id) ?? 0,
    isActiveGroup: group.id === activeGroupId,
  }))
  const sumOfGroupBalancesInCents = items.reduce((total, group) => total + group.balanceInCents, 0)

  return {
    groups: items,
    totalWalletInCents: financialView.globalBalance.availableInCents,
    sumOfGroupBalancesInCents,
    isConsistent: sumOfGroupBalancesInCents === financialView.globalBalance.availableInCents,
  }
}
