import { useState, type FormEvent } from 'react'
import type { Group } from '../../domain/entities'
import { FirestoreV4AdministrationFunctionsClient } from '../../infrastructure/functions/firestore-v4-administration-functions-client'

interface CreateGroupFormProps {
  administrationPin: string
  onGroupsChanged(): Promise<void>
}

/** Alta administrativa de grupo estándar V4; no crea subcolecciones ni movimientos financieros. */
export function CreateGroupForm({ administrationPin, onGroupsChanged }: CreateGroupFormProps) {
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return

    setMessage(null)
    setError(null)
    setIsSaving(true)
    try {
      const groupId = `v4-group-${crypto.randomUUID()}`
      const group = await new FirestoreV4AdministrationFunctionsClient().execute<Group>(
        administrationPin,
        'createGroup',
        groupId,
        { input: { id: groupId, name } },
      )
      await onGroupsChanged()
      setName('')
      setMessage(`Grupo ${group.name} creado correctamente.`)
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido crear el grupo: ${reason.message}` : 'No se ha podido crear el grupo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="create-group-form-section" aria-labelledby="create-group-title">
      <div className="section-heading"><div><p className="eyebrow">Grupos</p><h2 id="create-group-title">Añadir grupo</h2></div></div>
      <form className="group-create-form" onSubmit={handleSubmit}>
        <label>Nombre visible<input value={name} disabled={isSaving} onChange={(event) => setName(event.target.value)} required /></label>
        <button type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Crear grupo'}</button>
      </form>
      {message && <p className="operation-message">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}


