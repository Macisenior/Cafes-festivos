import { useState, type FormEvent } from 'react'
import type { GroupId, Person } from '../../domain/entities'
import { FirestoreV4AdministrationFunctionsClient } from '../../infrastructure/functions/firestore-v4-administration-functions-client'
import { createPersonRequest, resetPersonCreateForm } from './person-create-request'

interface CreatePersonFormProps {
  groupId: GroupId
  administrationPin: string
  onGroupChanged(): Promise<void>
}

function todayInMadrid(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** Alta administrativa V4: usa el servicio de personas; el componente no escribe en Firestore directamente. */
export function CreatePersonForm({ groupId, administrationPin, onGroupChanged }: CreatePersonFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [initialContributionInEuros, setInitialContributionInEuros] = useState('')
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
      const request = createPersonRequest({
        personId: `v4-person-${crypto.randomUUID()}`,
        contributionId: `v4-initial-contribution-${crypto.randomUUID()}`,
        groupId,
        name,
        phone,
        initialContributionInEuros,
        date: todayInMadrid(),
      })
      const created = await new FirestoreV4AdministrationFunctionsClient().execute<{ person: Person }>(
        administrationPin, 'createPerson', groupId, { request },
      )

      await onGroupChanged()
      const reset = resetPersonCreateForm()
      setName(reset.name)
      setPhone(reset.phone)
      setInitialContributionInEuros(reset.initialContributionInEuros)
      setMessage(`Persona ${created.person.name} creada correctamente.`)
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido crear la persona: ${reason.message}` : 'No se ha podido crear la persona.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="create-person-form-section" aria-labelledby="create-person-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Personas</p>
          <h2 id="create-person-title">Añadir persona</h2>
        </div>
      </div>
      <form className="person-create-form" onSubmit={handleSubmit}>
        <label>Nombre<input value={name} disabled={isSaving} onChange={(event) => setName(event.target.value)} required /></label>
        <label>Teléfono o contacto<input value={phone} disabled={isSaving} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>Aportación inicial opcional (€)<input value={initialContributionInEuros} disabled={isSaving} onChange={(event) => setInitialContributionInEuros(event.target.value)} inputMode="decimal" placeholder="0,00" /></label>
        <button type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Crear persona'}</button>
      </form>
      {message && <p className="operation-message">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}


