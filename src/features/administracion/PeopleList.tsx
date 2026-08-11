import { useEffect, useState, type FormEvent } from 'react'
import type { Contribution, Expense, GroupId, Person } from '../../domain/entities'
import { canPhysicallyDeletePerson } from '../../domain/persons'
import { FirestoreV4AdministrationFunctionsClient } from '../../infrastructure/functions/firestore-v4-administration-functions-client'
import { createAdministrationPeopleList } from './people-list'
import {
  canDeactivatePerson,
  canReactivatePerson,
  deactivationConfirmationText,
  reactivationConfirmationText,
} from './person-deactivation'

interface PeopleListProps {
  groupId: GroupId
  people: readonly Person[]
  contributions: readonly Contribution[]
  expenses: readonly Expense[]
  administrationPin: string
  onGroupChanged(): Promise<void>
}

type PendingPersonChange = { person: Person; action: 'deactivate' | 'reactivate' | 'delete' }

/** Listado administrativo: edita solo datos propios y cambia el estado activo mediante acciones confirmadas. */
export function PeopleList({ groupId, people, contributions, expenses, administrationPin, onGroupChanged }: PeopleListProps) {
  const personItems = createAdministrationPeopleList(groupId, people)
  const [pendingChange, setPendingChange] = useState<PendingPersonChange | null>(null)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingPhone, setEditingPhone] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPendingChange(null)
    setEditingPerson(null)
    setMessage(null)
    setError(null)
  }, [groupId])

  function startEditing(person: Person) {
    setPendingChange(null)
    setError(null)
    setEditingPerson(person)
    setEditingName(person.name)
    setEditingPhone(person.phone)
  }

  async function saveEdition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingPerson === null || isSaving) return

    setMessage(null)
    setError(null)
    setIsSaving(true)
    try {
      await new FirestoreV4AdministrationFunctionsClient().execute(
        administrationPin, 'editPerson', groupId, { edition: { id: editingPerson.id, name: editingName, phone: editingPhone } },
      )
      await onGroupChanged()
      setMessage(`Datos de ${editingName.trim()} actualizados correctamente.`)
      setEditingPerson(null)
      setEditingName('')
      setEditingPhone('')
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido editar la persona: ${reason.message}` : 'No se ha podido editar la persona.')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmPersonChange() {
    if (pendingChange === null || isSaving) return

    const { person, action } = pendingChange
    const isAllowed = action === 'deactivate'
      ? canDeactivatePerson(groupId, person)
      : action === 'reactivate'
        ? canReactivatePerson(groupId, person)
        : canPhysicallyDeletePerson(people, contributions, expenses, groupId, person.id)
    if (!isAllowed) return

    setMessage(null)
    setError(null)
    setIsSaving(true)
    try {
      const command = action === 'deactivate' ? 'deactivatePerson' : action === 'reactivate' ? 'reactivatePerson' : 'deletePerson'
      await new FirestoreV4AdministrationFunctionsClient().execute(administrationPin, command, groupId, { personId: person.id })
      await onGroupChanged()
      setMessage(action === 'deactivate'
        ? `${person.name} está ahora inactiva.`
        : action === 'reactivate'
          ? `${person.name} está ahora activa.`
          : `${person.name} se ha eliminado definitivamente.`)
      setPendingChange(null)
    } catch (reason) {
      const operation = action === 'deactivate' ? 'inactivar' : action === 'reactivate' ? 'reactivar' : 'borrar'
      setError(reason instanceof Error ? `No se ha podido ${operation} la persona: ${reason.message}` : `No se ha podido ${operation} la persona.`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="administration-people" aria-labelledby="administration-people-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Personas</p>
          <h2 id="administration-people-title">Personas del grupo</h2>
        </div>
        <span className="people-count">{personItems.length} personas</span>
      </div>
      {personItems.length === 0 ? (
        <p className="empty-state">Este grupo todavía no tiene personas registradas.</p>
      ) : (
        <ul className="administration-people-list">
          {personItems.map((person) => {
            const sourcePerson = people.find((candidate) => candidate.id === person.id && candidate.groupId === groupId)
            const canDeactivate = sourcePerson !== undefined && canDeactivatePerson(groupId, sourcePerson)
            const canReactivate = sourcePerson !== undefined && canReactivatePerson(groupId, sourcePerson)
            const canDelete = sourcePerson !== undefined
              && canPhysicallyDeletePerson(people, contributions, expenses, groupId, sourcePerson.id)

            return (
              <li key={person.id} className={person.isActive ? 'active-person' : 'inactive-person'}>
                <div>
                  <strong>{person.name}</strong>
                  {person.phone && <span>{person.phone}</span>}
                </div>
                <div className="person-list-actions">
                  <span className={`person-activity ${person.isActive ? 'active' : 'inactive'}`}>
                    {person.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                  {sourcePerson && <button type="button" disabled={isSaving} onClick={() => startEditing(sourcePerson)}>Editar</button>}
                  {canDeactivate && <button type="button" disabled={isSaving} onClick={() => setPendingChange({ person: sourcePerson, action: 'deactivate' })}>Dar de baja</button>}
                  {canReactivate && <button type="button" disabled={isSaving} onClick={() => setPendingChange({ person: sourcePerson, action: 'reactivate' })}>Reactivar</button>}
                  {canDelete && <button type="button" disabled={isSaving} onClick={() => setPendingChange({ person: sourcePerson, action: 'delete' })}>Borrar</button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editingPerson && (
        <form className="person-edit-form" onSubmit={saveEdition}>
          <h3>Editar persona</h3>
          <label>Nombre<input value={editingName} disabled={isSaving} onChange={(event) => setEditingName(event.target.value)} required /></label>
          <label>Teléfono o contacto<input value={editingPhone} disabled={isSaving} onChange={(event) => setEditingPhone(event.target.value)} /></label>
          <div>
            <button type="button" disabled={isSaving} onClick={() => setEditingPerson(null)}>Cancelar</button>
            <button type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </form>
      )}

      {pendingChange && (
        <div className="person-deactivation-confirmation" role="alert">
          <p>{pendingChange.action === 'deactivate'
            ? deactivationConfirmationText(pendingChange.person)
            : pendingChange.action === 'reactivate'
              ? reactivationConfirmationText(pendingChange.person)
              : `Vas a borrar definitivamente a ${pendingChange.person.name}. Esta acción no se puede deshacer.`}</p>
          <div>
            <button type="button" disabled={isSaving} onClick={() => setPendingChange(null)}>Cancelar</button>
            <button type="button" disabled={isSaving} onClick={() => void confirmPersonChange()}>
              {isSaving ? 'Guardando…' : pendingChange.action === 'deactivate' ? 'Confirmar baja' : pendingChange.action === 'reactivate' ? 'Confirmar reactivación' : 'Confirmar borrado'}
            </button>
          </div>
        </div>
      )}
      {message && <p className="operation-message">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}

