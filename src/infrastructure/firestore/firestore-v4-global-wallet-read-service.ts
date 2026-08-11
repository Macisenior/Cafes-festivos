import { createGlobalFinancialView, type GlobalFinancialView, type GroupFinancialEntities } from '../../domain/financial-adapter'
import type { Group, GroupId } from '../../domain/entities'

export interface V4GlobalWalletReadPort {
  listAvailableGroups(): Promise<readonly Group[]>
  readGroup(groupId: GroupId): Promise<GroupFinancialEntities>
}

export interface V4GlobalWalletReadResult {
  groups: readonly Group[]
  /** Misma lectura V4 utilizada para los balances globales; no añade consultas. */
  entities: readonly GroupFinancialEntities[]
  financialView: GlobalFinancialView
}

/** Lectura V4 de todos los agregados de grupo; no escribe ni modifica el grupo activo. */
export class FirestoreV4GlobalWalletReadService {
  private readonly reader: V4GlobalWalletReadPort

  constructor(reader: V4GlobalWalletReadPort) {
    this.reader = reader
  }

  async readCurrentWallet(): Promise<V4GlobalWalletReadResult> {
    const groups = await this.reader.listAvailableGroups()
    const entities = await Promise.all(groups.map((group) => this.reader.readGroup(group.id)))

    return { groups, entities, financialView: createGlobalFinancialView(entities) }
  }
}