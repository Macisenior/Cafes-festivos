import { useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import type { Group } from '../../domain/entities'
import { ActiveGroupSelector } from '../grupos/ActiveGroupSelector'
import { AdministrationMenu } from './AdministrationMenu'
import { CreateGroupForm } from './CreateGroupForm'
import { CreatePersonForm } from './CreatePersonForm'
import { ExpenseDeletionAdmin } from './ExpenseDeletionAdmin'
import { GroupList } from './GroupList'
import { PeopleList } from './PeopleList'
import { GroupOperationalHistory } from '../operativa/GroupOperationalHistory'
import { ExpensesByPersonReport } from './ExpensesByPersonReport'
import { ContributionsByPersonReport } from './ContributionsByPersonReport'
import { GlobalWalletSummary } from './GlobalWalletSummary'
import { AccountStateAtDateReport } from './AccountStateAtDateReport'
import { StateBetweenDatesReport } from './StateBetweenDatesReport'
import { ProSummaryReport } from './ProSummaryReport'
import { SystemBackup } from './SystemBackup'
import {
  openAdministrationArea,
  returnToAdministrationMenu,
  type AdministrationArea,
} from './administration-navigation'

interface AdministrationPageProps {
  firestore: Firestore
  availableGroups: readonly Group[]
  entities: GroupFinancialEntities
  isChangingGroup: boolean
  groupError: string | null
  onChangeGroup(groupId: string): void
  onGroupChanged(): Promise<void>
  onGroupsChanged(): Promise<void>
  administrationPin: string
  onLock(): void
}

/** Pantalla 3. Un futuro guard de PIN de administración envolverá este contenido. */
export function AdministrationPage({
  firestore,
  availableGroups,
  entities,
  isChangingGroup,
  groupError,
  onChangeGroup,
  onGroupChanged,
  onGroupsChanged,
  administrationPin,
  onLock,
}: AdministrationPageProps) {
  const [area, setArea] = useState<AdministrationArea>('menu')

  function openArea(nextArea: Exclude<AdministrationArea, 'menu'>) {
    setArea(openAdministrationArea(nextArea))
  }

  function returnFromArea() {
    setArea(area === 'expenses-by-person' || area === 'contributions-by-person' || area === 'global-wallet' || area === 'account-state-at-date' || area === 'state-between-dates' || area === 'pro-summary' ? 'reports' : returnToAdministrationMenu())
  }

  return (
    <section className="administration-page" data-admin-pin-protection="administration">
      <header className="administration-header">
        <p className="eyebrow">Administración</p>
        <h1>Administración de {entities.group.name}</h1>
        <button type="button" className="lock-screen-button" onClick={onLock}>Bloquear Administración</button>
        <ActiveGroupSelector
          activeGroupId={entities.group.id}
          availableGroups={availableGroups}
          isChanging={isChangingGroup}
          onChange={onChangeGroup}
        />
        {groupError && <p className="group-error" role="alert">{groupError}</p>}
      </header>

      {area !== 'menu' && (
        <button type="button" className="administration-back-button" onClick={returnFromArea}>
          ← Volver a Administración
        </button>
      )}

      {area === 'menu' && <AdministrationMenu onOpen={openArea} />}

      {area === 'people' && (
        <section className="administration-area" aria-label="Personas">
          <CreatePersonForm
            groupId={entities.group.id}
            administrationPin={administrationPin}
            onGroupChanged={onGroupChanged}
          />
          <PeopleList
            groupId={entities.group.id}
            people={entities.people}
            contributions={entities.contributions}
            expenses={entities.expenses}
            administrationPin={administrationPin}
            onGroupChanged={onGroupChanged}
          />
        </section>
      )}

      {area === 'groups' && (
        <section className="administration-area" aria-label="Grupos">
          <GroupList
            groups={availableGroups}
            activeGroupId={entities.group.id}
            firestore={firestore}
            onGroupsChanged={onGroupsChanged}
            administrationPin={administrationPin}
          />
          <CreateGroupForm administrationPin={administrationPin} onGroupsChanged={onGroupsChanged} />
        </section>
      )}

      {area === 'expenses' && (
        <section className="administration-area" aria-label="Gastos">
          <ExpenseDeletionAdmin
            group={entities.group}
            people={entities.people}
            expenses={entities.expenses}
            administrationPin={administrationPin}
            onGroupChanged={onGroupChanged}
          />
        </section>
      )}

      {area === 'history' && (
        <section className="administration-area" aria-label="Históricos">
          <GroupOperationalHistory
            groupId={entities.group.id}
            people={entities.people}
            contributions={entities.contributions}
            expenses={entities.expenses}
            title="Históricos"
            eyebrow="Administración"
            groupName={entities.group.name}
            emptyMessage="Este grupo no tiene movimientos históricos."
            enableFilters
            defaultToCurrentMonth
          />
        </section>
      )}

      {area === 'reports' && (
        <section className="administration-menu" aria-label="Informes">
          <div className="section-heading"><div><p className="eyebrow">Informes</p><h2>Informes administrativos</h2></div></div>
          <ul>
            <li><button type="button" onClick={() => openArea('expenses-by-person')}><strong>📊 Gastos por persona</strong><span>Consumo real por asignaciones finales de gasto.</span></button></li>
            <li><button type="button" onClick={() => openArea('contributions-by-person')}><strong>💶 Aportaciones por persona</strong><span>Entradas reales por movimientos de aportación.</span></button></li>
            <li><button type="button" onClick={() => openArea('global-wallet')}><strong>💼 Resumen global</strong><span>Estado actual de todos los monederos V4.</span></button></li>
            <li><button type="button" onClick={() => openArea('account-state-at-date')}><strong>📅 Estado a una fecha</strong><span>Estado de cuentas del grupo activo a cierre de un día.</span></button></li>
            <li><button type="button" onClick={() => openArea('state-between-dates')}><strong>📈 Estado entre fechas</strong><span>Evolución acumulada del estado del grupo.</span></button></li>
            <li><button type="button" onClick={() => openArea('pro-summary')}><strong>📋 Resumen PRO</strong><span>Detalle actual de aportaciones, gasto y saldo por persona.</span></button></li>
          </ul>
        </section>
      )}

      {area === 'expenses-by-person' && (
        <section className="administration-area" aria-label="Gastos por persona">
          <ExpensesByPersonReport group={entities.group} people={entities.people} expenses={entities.expenses} />
        </section>
      )}

      {area === 'contributions-by-person' && (
        <section className="administration-area" aria-label="Aportaciones por persona">
          <ContributionsByPersonReport group={entities.group} people={entities.people} contributions={entities.contributions} />
        </section>
      )}

      {area === 'global-wallet' && (
        <section className="administration-area" aria-label="Resumen global">
          <GlobalWalletSummary firestore={firestore} activeGroupId={entities.group.id} />
        </section>
      )}

      {area === 'account-state-at-date' && (
        <section className="administration-area" aria-label="Estado a una fecha">
          <AccountStateAtDateReport group={entities.group} people={entities.people} contributions={entities.contributions} expenses={entities.expenses} />
        </section>
      )}

      {area === 'state-between-dates' && (
        <section className="administration-area" aria-label="Estado entre fechas">
          <StateBetweenDatesReport group={entities.group} people={entities.people} contributions={entities.contributions} expenses={entities.expenses} />
        </section>
      )}

      {area === 'system' && (
        <section className="administration-area" aria-label="Sistema"><SystemBackup firestore={firestore} /></section>
      )}
      {area === 'pro-summary' && (
        <section className="administration-area" aria-label="Resumen PRO">
          <ProSummaryReport group={entities.group} people={entities.people} contributions={entities.contributions} expenses={entities.expenses} firestore={firestore} administrationPin={administrationPin} onGroupChanged={onGroupChanged} />
        </section>
      )}
    </section>
  )
}






