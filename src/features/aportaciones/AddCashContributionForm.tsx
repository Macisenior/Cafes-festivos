import { useState, type FormEvent } from 'react'
import type { Firestore } from 'firebase/firestore'
import type { Contribution, GroupId, Person } from '../../domain/entities'
import { FirestoreV4OperationalFunctionsClient } from '../../infrastructure/functions/firestore-v4-operational-functions-client'

import { FirestoreV4GroupReadService } from '../../infrastructure/firestore/firestore-v4-group-read-service'
import {
  resetCashFormAfterSave,
  summarizeSameDayContributions,
  type SameDayContributionSummary,
} from './cash-contribution-confirmation'
import { eurosToCents } from './cash-contribution-request'

interface AddCashContributionFormProps {
  groupId: GroupId
  people: readonly Person[]
  firestore: Firestore
  operationalPin: string
  onGroupChanged(): Promise<void>
}

interface PendingContribution {
  people: readonly Person[]
  contributions: readonly Contribution[]
  personName: string
  input: {
    id: string
    groupId: GroupId
    personId: string
    amountInCents: number
    date: string
  }
  previous: SameDayContributionSummary
}

function todayInMadrid(): string {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    dateParts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${values.year}-${values.month}-${values.day}`
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amountInCents / 100)
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

function confirmationText(pendingContribution: PendingContribution): string {
  const { count, totalInCents } = pendingContribution.previous

  if (count === 1) {
    return `⚠️ ${pendingContribution.personName} ya tiene una aportación registrada ese día de ${formatCurrency(totalInCents)}. ¿Quieres añadir otra aportación de ${formatCurrency(pendingContribution.input.amountInCents)}?`
  }

  return `⚠️ ${pendingContribution.personName} ya tiene ${count} aportaciones ese día por un total de ${formatCurrency(totalInCents)}. ¿Quieres registrar otra aportación de ${formatCurrency(pendingContribution.input.amountInCents)}?`
}

export function AddCashContributionForm({
  groupId,
  people,
  firestore,
  operationalPin,
  onGroupChanged,
}: AddCashContributionFormProps) {
  const activePeople = people.filter((person) => person.groupId === groupId && person.isActive)
  const [personId, setPersonId] = useState('')
  const [amountInEuros, setAmountInEuros] = useState('')
  const [date, setDate] = useState(todayInMadrid)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingContribution, setPendingContribution] = useState<PendingContribution | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isWaitingForConfirmation = pendingContribution !== null

  async function saveContribution(pending: PendingContribution) {
    setIsSaving(true)

    try {
      const contribution = await new FirestoreV4OperationalFunctionsClient().createCashContribution(
        operationalPin,
        pending.input,
      )

      await onGroupChanged()
      const resetValues = resetCashFormAfterSave(date)
      setPersonId(resetValues.personId)
      setAmountInEuros(resetValues.amountInEuros)
      setMessage(
        `Aportación de ${formatCurrency(contribution.amountInCents)} para ${pending.personName} guardada correctamente con fecha ${formatDate(contribution.date ?? date)}.`,
      )
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `No se ha podido guardar la aportación: ${reason.message}`
          : 'No se ha podido guardar la aportación.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || isWaitingForConfirmation) return

    setMessage(null)
    setError(null)
    setIsSaving(true)

    try {
      const latestEntities = await new FirestoreV4GroupReadService(firestore).readGroup(groupId)
      const selectedPerson = latestEntities.people.find(
        (person) => person.id === personId && person.groupId === groupId && person.isActive,
      )

      if (selectedPerson === undefined) {
        throw new Error('La persona seleccionada no existe o ya no está activa.')
      }

      const input = {
        id: `v4-contribution-${crypto.randomUUID()}`,
        groupId,
        personId,
        amountInCents: eurosToCents(amountInEuros),
        date,
      }
      const previous = summarizeSameDayContributions(latestEntities.contributions, personId, date)
      const pending = {
        people: latestEntities.people,
        contributions: latestEntities.contributions,
        personName: selectedPerson.name,
        input,
        previous,
      }

      if (previous.count > 0) {
        setPendingContribution(pending)
        return
      }

      await saveContribution(pending)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `No se ha podido preparar la aportación: ${reason.message}`
          : 'No se ha podido preparar la aportación.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmPendingContribution() {
    if (pendingContribution === null || isSaving) return

    setMessage(null)
    setError(null)
    setPendingContribution(null)
    await saveContribution(pendingContribution)
  }

  function cancelPendingContribution() {
    if (isSaving) return
    setPendingContribution(null)
  }

  return (
    <section className="cash-form-section" aria-labelledby="cash-form-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Aportación</p>
          <h2 id="cash-form-title">Añadir efectivo</h2>
        </div>
      </div>

      <form className="cash-form" onSubmit={handleSubmit}>
        <label>
          Persona
          <select
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            disabled={isSaving || isWaitingForConfirmation}
            required
          >
            <option value="">Selecciona una persona</option>
            {activePeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Importe (€)
          <input
            value={amountInEuros}
            onChange={(event) => setAmountInEuros(event.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            disabled={isSaving || isWaitingForConfirmation}
            required
          />
        </label>
        <label>
          Fecha del ingreso
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={isSaving || isWaitingForConfirmation}
            required
          />
        </label>
        <button type="submit" disabled={isSaving || isWaitingForConfirmation}>
          {isSaving ? 'Comprobando…' : 'Añadir efectivo'}
        </button>
      </form>

      {pendingContribution && (
        <div className="same-day-confirmation" role="alert">
          <p>{confirmationText(pendingContribution)}</p>
          <div>
            <button type="button" onClick={cancelPendingContribution}>Cancelar</button>
            <button type="button" onClick={confirmPendingContribution}>Confirmar aportación</button>
          </div>
        </div>
      )}
      {message && <p className="operation-message">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
