import { useEffect, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import { createGroupFinancialView } from '../domain/financial-adapter'
import type { GroupFinancialEntities, GroupFinancialView } from '../domain/financial-adapter'
import type { Group } from '../domain/entities'
import { connectFirebaseForReadOnly } from '../infrastructure/firebase/firebase-client'
import { FirestoreV4GroupReadService } from '../infrastructure/firestore/firestore-v4-group-read-service'
import {
  DEFAULT_ACTIVE_GROUP_ID,
  restoreActiveGroupId,
  saveActiveGroupId,
} from '../features/grupos/active-group'
import { InformationPage } from '../features/informacion/InformationPage'
import {
  getActivePeople,
  restoreSelectedPersonId,
  saveSelectedPersonId,
} from '../features/identificacion/local-user'
import { OperationalPage } from '../features/operativa/OperationalPage'
import { AdministrationPage } from '../features/administracion/AdministrationPage'
import { PinGuard } from '../features/acceso/PinGuard'
import { initialAccessSessions, lockArea, unlockArea } from '../features/acceso/pin-access'
import { FirestoreV4OperationalFunctionsClient } from '../infrastructure/functions/firestore-v4-operational-functions-client'
import { FirestoreV4AdministrationFunctionsClient } from '../infrastructure/functions/firestore-v4-administration-functions-client'

type Screen = 'information' | 'operational' | 'administration'

type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      firestore: Firestore
      availableGroups: readonly Group[]
      entities: GroupFinancialEntities
      financialView: GroupFinancialView
    }

/** Conserva una única lectura, un único grupo activo y un único recálculo compartidos por las pantallas V4. */
export function GroupWorkspace() {
  const [state, setState] = useState<WorkspaceState>({ status: 'loading' })
  const [screen, setScreen] = useState<Screen>('information')
  const [accessSessions, setAccessSessions] = useState(initialAccessSessions)
  const [operationalPin, setOperationalPin] = useState<string | null>(null)
  const [administrationPin, setAdministrationPin] = useState<string | null>(null)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false)
  const [isChangingGroup, setIsChangingGroup] = useState(false)
  const [groupError, setGroupError] = useState<string | null>(null)

  function restorePersonForGroup(entities: GroupFinancialEntities) {
    const activePeople = getActivePeople(entities.people, entities.group.id)
    const restoredPersonId = restoreSelectedPersonId(window.localStorage, activePeople, entities.group.id)
    setSelectedPersonId(restoredPersonId)
    setIsUserPickerOpen(restoredPersonId === null)
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialGroup() {
      try {
        const firestore = await connectFirebaseForReadOnly()
        const groupReader = new FirestoreV4GroupReadService(firestore)
        const availableGroups = await groupReader.listAvailableGroups()
        const requestedGroupId = restoreActiveGroupId(
          window.localStorage,
          availableGroups.map((group) => group.id),
        )
        const groupId = availableGroups.some((group) => group.id === requestedGroupId)
          ? requestedGroupId
          : DEFAULT_ACTIVE_GROUP_ID
        const entities = await groupReader.readGroup(groupId)
        const financialView = createGroupFinancialView(entities)

        if (!cancelled) {
          saveActiveGroupId(window.localStorage, entities.group.id)
          setState({ status: 'ready', firestore, availableGroups, entities, financialView })
          restorePersonForGroup(entities)
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error', message: 'No se ha podido cargar el grupo. Comprueba la configuración de lectura.' })
        }
      }
    }

    void loadInitialGroup()
    return () => { cancelled = true }
  }, [])

  async function reloadActiveGroup() {
    if (state.status !== 'ready') return

    const entities = await new FirestoreV4GroupReadService(state.firestore).readGroup(state.entities.group.id)
    setState({ ...state, entities, financialView: createGroupFinancialView(entities) })
  }

  async function reloadAvailableGroups() {
    if (state.status !== 'ready') return

    const groupReader = new FirestoreV4GroupReadService(state.firestore)
    const [availableGroups, entities] = await Promise.all([
      groupReader.listAvailableGroups(),
      groupReader.readGroup(state.entities.group.id),
    ])
    setState({ ...state, availableGroups, entities, financialView: createGroupFinancialView(entities) })
  }

  async function changeGroup(nextGroupId: string) {
    if (state.status !== 'ready' || isChangingGroup) return

    setGroupError(null)
    setIsChangingGroup(true)
    try {
      const groupId = state.availableGroups.some((group) => group.id === nextGroupId)
        ? nextGroupId
        : DEFAULT_ACTIVE_GROUP_ID
      const entities = await new FirestoreV4GroupReadService(state.firestore).readGroup(groupId)
      saveActiveGroupId(window.localStorage, entities.group.id)
      setState({ ...state, entities, financialView: createGroupFinancialView(entities) })
      restorePersonForGroup(entities)
    } catch {
      setGroupError('No se ha podido cambiar de grupo. Se mantiene el grupo actual.')
    } finally {
      setIsChangingGroup(false)
    }
  }

  function selectPerson(personId: string) {
    if (state.status !== 'ready') return
    saveSelectedPersonId(window.localStorage, state.entities.group.id, personId)
    setSelectedPersonId(personId)
    setIsUserPickerOpen(false)
  }

  if (state.status === 'loading') return <main className="app-shell status-page">Cargando el grupo…</main>
  if (state.status === 'error') return <main className="app-shell status-page">{state.message}</main>

  const selectedPerson = getActivePeople(state.entities.people, state.entities.group.id)
    .find((person) => person.id === selectedPersonId) ?? null

  return (
    <main className="app-shell">
      <nav className="app-navigation" aria-label="Pantallas principales">
        <button type="button" className={screen === 'information' ? 'active' : ''} onClick={() => setScreen('information')}>Información</button>
        <button type="button" className={screen === 'operational' ? 'active' : ''} onClick={() => setScreen('operational')}>Operativa</button>
        <button type="button" className={screen === 'administration' ? 'active' : ''} onClick={() => setScreen('administration')}>Administración</button>
      </nav>
      {screen === 'information' ? (
        <InformationPage
          firestore={state.firestore}
          availableGroups={state.availableGroups}
          entities={state.entities}
          financialView={state.financialView}
          selectedPerson={selectedPerson}
          isUserPickerOpen={isUserPickerOpen}
          isChangingGroup={isChangingGroup}
          groupError={groupError}
          onChangeGroup={(groupId) => void changeGroup(groupId)}
          onToggleUserPicker={() => setIsUserPickerOpen((isOpen) => !isOpen)}
          onSelectPerson={selectPerson}
        />
      ) : screen === 'operational' ? (
        <PinGuard
          area="operational"
          isUnlocked={accessSessions.operational}
          isConfigured
          validatePin={(pin) => new FirestoreV4OperationalFunctionsClient().verifyOperationalPin(pin)}
          onUnlock={(pin) => {
            setOperationalPin(pin)
            setAccessSessions((sessions) => unlockArea(sessions, 'operational'))
          }}
        >
          <OperationalPage
            firestore={state.firestore}
            availableGroups={state.availableGroups}
            entities={state.entities}
            isChangingGroup={isChangingGroup}
            groupError={groupError}
            onChangeGroup={(groupId) => void changeGroup(groupId)}
            onGroupChanged={reloadActiveGroup}
            operationalPin={operationalPin ?? ''}
            onLock={() => {
              setOperationalPin(null)
              setAccessSessions((sessions) => lockArea(sessions, 'operational'))
            }}
          />
        </PinGuard>
      ) : (
        <PinGuard
          area="administration"
          isUnlocked={accessSessions.administration}
          isConfigured
          validatePin={(pin) => new FirestoreV4AdministrationFunctionsClient().verifyAdministrationPin(pin)}
          onUnlock={(pin) => {
            setAdministrationPin(pin)
            setAccessSessions((sessions) => unlockArea(sessions, 'administration'))
          }}
        >
          <AdministrationPage
            firestore={state.firestore}
            availableGroups={state.availableGroups}
            entities={state.entities}
            isChangingGroup={isChangingGroup}
            groupError={groupError}
            onChangeGroup={(groupId) => void changeGroup(groupId)}
            onGroupChanged={reloadActiveGroup}
            onGroupsChanged={reloadAvailableGroups}
            administrationPin={administrationPin ?? ''}
            onLock={() => {
              setAdministrationPin(null)
              setAccessSessions((sessions) => lockArea(sessions, 'administration'))
            }}
          />
        </PinGuard>
      )}
      <footer className="app-footer" aria-label="Información del proyecto">
        <p className="app-footer-project"><strong>Proyecto Gastos del Grupo</strong><span>Versión 4.0</span></p>
        <p>Creado por José Luis Izquierdo <span aria-hidden="true">·</span> Desarrollado junto a ChatGPT (OpenAI)</p>
      </footer>
    </main>
  )
}

