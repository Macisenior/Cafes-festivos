import { useEffect, useState, type FormEvent } from 'react'
import type { Firestore } from 'firebase/firestore'
import type { Group, GroupId } from '../../domain/entities'
import type { GroupDeletionEligibility } from '../../domain/groups'
import { FirestoreV4GroupReadService } from '../../infrastructure/firestore/firestore-v4-group-read-service'
import {
  FirestoreV4GroupDeletionService,
  FirestoreV4GroupPersistence,
} from '../../infrastructure/firestore/firestore-v4-group-service'
import { createAdministrationGroupList } from './group-list'
import { FirestoreV4AdministrationFunctionsClient } from '../../infrastructure/functions/firestore-v4-administration-functions-client'

interface GroupListProps {
  groups: readonly Group[]
  activeGroupId: GroupId
  firestore: Firestore
  onGroupsChanged(): Promise<void>
  administrationPin: string
}

type EligibilityByGroupId = Readonly<Record<string, GroupDeletionEligibility>>

/** Listado administrativo: edita nombres y solo permite borrar grupos vacíos tras confirmación. */
export function GroupList({ groups, activeGroupId, firestore, onGroupsChanged, administrationPin }: GroupListProps) {
  const groupItems = createAdministrationGroupList(groups, activeGroupId)
  const [eligibilityByGroupId, setEligibilityByGroupId] = useState<EligibilityByGroupId>({})
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<Group | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const deletionService = new FirestoreV4GroupDeletionService(
      new FirestoreV4GroupReadService(firestore),
      new FirestoreV4GroupPersistence(firestore),
    )

    async function inspectGroups() {
      const results = await Promise.all(groups.map(async (group) => {
        try {
          return [group.id, await deletionService.inspect(group.id, activeGroupId)] as const
        } catch {
          return [group.id, {
            canDelete: false,
            reason: 'No se ha podido comprobar si el grupo está vacío.',
          }] as const
        }
      }))

      if (!cancelled) setEligibilityByGroupId(Object.fromEntries(results))
    }

    void inspectGroups()
    return () => { cancelled = true }
  }, [groups, activeGroupId, firestore])

  useEffect(() => {
    setEditingGroup(null)
    setPendingDeletion(null)
    setEditingName('')
    setMessage(null)
    setError(null)
  }, [activeGroupId])

  function startEditing(group: Group) {
    setPendingDeletion(null)
    setError(null)
    setEditingGroup(group)
    setEditingName(group.name)
  }

  async function saveEdition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingGroup === null || isSaving) return

    setMessage(null)
    setError(null)
    setIsSaving(true)
    try {
      const edited = await new FirestoreV4AdministrationFunctionsClient().execute<Group>(
        administrationPin, 'editGroupName', editingGroup.id, { name: editingName },
      )
      await onGroupsChanged()
      setEditingGroup(null)
      setEditingName('')
      setMessage(`Nombre de ${edited.name} actualizado correctamente.`)
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido editar el grupo: ${reason.message}` : 'No se ha podido editar el grupo.')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDeletion() {
    if (pendingDeletion === null || isSaving) return

    setMessage(null)
    setError(null)
    setIsSaving(true)
    try {
      await new FirestoreV4AdministrationFunctionsClient().execute(
        administrationPin, 'deleteEmptyGroup', pendingDeletion.id, { activeGroupId },
      )
      await onGroupsChanged()
      setPendingDeletion(null)
      setMessage(`Grupo ${pendingDeletion.name} eliminado definitivamente.`)
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido borrar el grupo: ${reason.message}` : 'No se ha podido borrar el grupo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="administration-groups" aria-labelledby="administration-groups-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Grupos</p>
          <h2 id="administration-groups-title">Grupos disponibles</h2>
        </div>
        <span className="people-count">{groupItems.length} grupos</span>
      </div>
      {groupItems.length === 0 ? (
        <p className="empty-state">No hay grupos V4 disponibles.</p>
      ) : (
        <ul className="administration-group-list">
          {groupItems.map((group) => {
            const sourceGroup = groups.find((candidate) => candidate.id === group.id)
            const deletionEligibility = eligibilityByGroupId[group.id]
            return (
              <li key={group.id} className={group.isActiveGroup ? 'active-group-item' : undefined}>
                <div>
                  <strong>{group.name}</strong>
                  <span>ID: {group.id}</span>
                </div>
                <div className="group-list-statuses">
                  <span className="group-kind">{group.isMainGroup ? 'Grupo principal' : 'Grupo estándar'}</span>
                  {group.isActiveGroup && <span className="active-group-badge">Grupo activo</span>}
                  {deletionEligibility?.reason && <span className="group-delete-reason">{deletionEligibility.reason}</span>}
                  {sourceGroup && <button type="button" disabled={isSaving} onClick={() => startEditing(sourceGroup)}>Editar</button>}
                  {sourceGroup && deletionEligibility?.canDelete && <button type="button" disabled={isSaving} onClick={() => setPendingDeletion(sourceGroup)}>Borrar</button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editingGroup && (
        <form className="group-edit-form" onSubmit={saveEdition}>
          <h3>Editar grupo</h3>
          <label>Nombre visible<input value={editingName} disabled={isSaving} onChange={(event) => setEditingName(event.target.value)} required /></label>
          <div>
            <button type="button" disabled={isSaving} onClick={() => setEditingGroup(null)}>Cancelar</button>
            <button type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </form>
      )}

      {pendingDeletion && (
        <div className="group-deletion-confirmation" role="alert">
          <p>Vas a borrar definitivamente el grupo {pendingDeletion.name}. Esta acción no se puede deshacer.</p>
          <div>
            <button type="button" disabled={isSaving} onClick={() => setPendingDeletion(null)}>Cancelar</button>
            <button type="button" disabled={isSaving} onClick={() => void confirmDeletion()}>{isSaving ? 'Borrando…' : 'Confirmar borrado'}</button>
          </div>
        </div>
      )}
      {message && <p className="operation-message">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

