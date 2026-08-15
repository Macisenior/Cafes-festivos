import type { Firestore } from 'firebase/firestore'
import type { GroupFinancialEntities, GroupFinancialView } from '../../domain/financial-adapter'
import type { Group } from '../../domain/entities'
import { AddCashContributionForm } from '../aportaciones/AddCashContributionForm'
import { AddExpenseForm } from '../gastos/AddExpenseForm'
import { QuickExpenseDisclosure } from '../informacion/QuickExpenseDisclosure'
import { ActiveGroupSelector } from '../grupos/ActiveGroupSelector'
import { ExpensesBySite } from '../informacion/ExpensesBySite'
import { AccountStatusList } from '../informacion/AccountStatusList'

interface OperationalPageProps {
  firestore: Firestore
  availableGroups: readonly Group[]
  entities: GroupFinancialEntities
  financialView: GroupFinancialView
  selectedPersonId: string | null
  operationalPin: string
  isChangingGroup: boolean
  groupError: string | null
  onChangeGroup(groupId: string): void
  onGroupChanged(): Promise<void>
  onLock(): void
}

/** Pantalla 2: operaciones V4 del grupo activo. */
export function OperationalPage({ firestore, availableGroups, entities, financialView, selectedPersonId, operationalPin, isChangingGroup, groupError, onChangeGroup, onGroupChanged, onLock }: OperationalPageProps) {
  return <section className="operational-page" data-pin-protection="operational">
    <div className="operational-header">
      <p className="eyebrow">Operativa</p><h1>Movimientos de {entities.group.name}</h1>
      <button type="button" className="lock-screen-button" onClick={onLock}>Bloquear Operativa</button>
      <ActiveGroupSelector activeGroupId={entities.group.id} availableGroups={availableGroups} isChanging={isChangingGroup} onChange={onChangeGroup} />
      {groupError && <p className="group-error" role="alert">{groupError}</p>}
    </div>
    <AccountStatusList entities={entities} financialView={financialView} selectedPersonId={selectedPersonId} />    <AddCashContributionForm groupId={entities.group.id} people={entities.people} firestore={firestore} operationalPin={operationalPin} onGroupChanged={onGroupChanged} />
    <AddExpenseForm group={entities.group} people={entities.people} expenses={entities.expenses} operationalPin={operationalPin} onGroupChanged={onGroupChanged} />
    <ExpensesBySite groupId={entities.group.id} expenses={entities.expenses} />
    <QuickExpenseDisclosure group={entities.group} people={entities.people} />
  </section>
}