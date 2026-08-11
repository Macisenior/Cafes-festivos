import type { Firestore } from 'firebase/firestore'
import type { GroupFinancialEntities, GroupFinancialView } from '../../domain/financial-adapter'
import type { Group, Person } from '../../domain/entities'
import { GlobalWalletSummary } from '../administracion/GlobalWalletSummary'
import { AccountStatusList } from './AccountStatusList'
import { ActiveGroupSelector } from '../grupos/ActiveGroupSelector'
import { greetingForHour } from '../identificacion/local-user'
import { ExpensesBySite } from './ExpensesBySite'
import { QuickExpenseDisclosure } from './QuickExpenseDisclosure'

interface InformationPageProps {
  firestore: Firestore
  availableGroups: readonly Group[]
  entities: GroupFinancialEntities
  financialView: GroupFinancialView
  selectedPerson: Person | null
  isUserPickerOpen: boolean
  isChangingGroup: boolean
  groupError: string | null
  onChangeGroup(groupId: string): void
  onToggleUserPicker(): void
  onSelectPerson(personId: string): void
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amountInCents / 100)
}

function groupStatusText(balanceInCents: number): string {
  if (balanceInCents > 0) return 'El grupo dispone de saldo'
  if (balanceInCents < 0) return 'El grupo tiene saldo pendiente'
  return 'Las cuentas están equilibradas'
}


/** Pantalla 1: consulta pública sobre el grupo activo, sin operaciones de escritura. */
export function InformationPage({
  firestore,
  availableGroups,
  entities,
  financialView,
  selectedPerson,
  isUserPickerOpen,
  isChangingGroup,
  groupError,
  onChangeGroup,
  onToggleUserPicker,
  onSelectPerson,
}: InformationPageProps) {
  const balancesByPersonId = new Map(
    financialView.personBalances.map((balance) => [balance.personId, balance]),
  )
  const activePeople = entities.people.filter((person) => person.groupId === entities.group.id && person.isActive)
  const selectedBalance = selectedPerson ? balancesByPersonId.get(selectedPerson.id)?.availableInCents ?? 0 : null
  const todayLabel = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

  return (
    <section className="information-page" aria-label="Información del grupo">
      <section className="group-hero information-hero" aria-labelledby="group-name">
        <div className="information-hero-orb" aria-hidden="true" />
        <header className="information-hero-top">
          <div><p className="eyebrow">Gastos del Grupo</p><p className="information-hero-kicker">Tu vista de hoy</p></div>
          <div className="information-group-control"><span>Grupo activo</span><ActiveGroupSelector activeGroupId={entities.group.id} availableGroups={availableGroups} isChanging={isChangingGroup} onChange={onChangeGroup} /></div>
        </header>
        {groupError && <p className="group-error" role="alert">{groupError}</p>}
        <div className="information-hero-welcome">
          <p>{selectedPerson ? greetingForHour(new Date().getHours()) : 'Hola'}</p>
          <h1 id="group-name">{selectedPerson?.name ?? entities.group.name}</h1>
          <button className="change-user-button" type="button" onClick={onToggleUserPicker}>Cambiar usuario</button>
        </div>
        <div className="information-group-balance">
          <p className="group-status">{groupStatusText(financialView.groupBalance.availableInCents)}</p>
          <p className="group-balance">{formatCurrency(financialView.groupBalance.availableInCents)}</p>
          <p className="group-name">{entities.group.name}</p>
        </div>
        {selectedBalance !== null && <aside className="information-personal-balance"><span>Tu saldo</span><strong className={selectedBalance > 0 ? 'positive' : selectedBalance < 0 ? 'negative' : ''}>{formatCurrency(selectedBalance)}</strong></aside>}
        <footer className="information-hero-footer"><span className="information-live-dot" aria-hidden="true" />Actualizado hoy · {todayLabel}</footer>
      </section>

      {isUserPickerOpen && (
        <section className="user-picker information-user-picker" aria-labelledby="user-picker-title">
          <h2 id="user-picker-title">¿Quién está usando la aplicación?</h2>
          <p>Elige tu nombre. Solo se recordará esta selección en este dispositivo y para este grupo.</p>
          <div className="user-options">
            {activePeople.map((person) => <button key={person.id} type="button" onClick={() => onSelectPerson(person.id)}>{person.name}</button>)}
          </div>
        </section>
      )}

      <AccountStatusList entities={entities} financialView={financialView} />

      <div className="information-wallet"><GlobalWalletSummary firestore={firestore} activeGroupId={entities.group.id} selectedPersonId={selectedPerson?.id ?? null} presentation="information" /></div>

      <div className="information-sites"><ExpensesBySite groupId={entities.group.id} expenses={entities.expenses} /></div>

      <QuickExpenseDisclosure group={entities.group} people={entities.people} />
    </section>
  )
}
