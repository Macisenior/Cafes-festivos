import { useState, type FormEvent } from 'react'
import type { Firestore } from 'firebase/firestore'
import type { Contribution, GroupId, Person } from '../../domain/entities'
import { createGroupFinancialView } from '../../domain/financial-adapter'
import { FirestoreV4OperationalFunctionsClient } from '../../infrastructure/functions/firestore-v4-operational-functions-client'

import { FirestoreV4GroupReadService } from '../../infrastructure/firestore/firestore-v4-group-read-service'
import {
  resetCashFormAfterSave,
  summarizeSameDayContributions,
  type SameDayContributionSummary,
} from './cash-contribution-confirmation'
import { eurosToCents } from './cash-contribution-request'
import {
  CONTRIBUTION_RECEIPT_STORAGE_KEY,
  contributionReceiptText,
  contributionReceiptWhatsAppUrl,
  parseContributionReceipt,
  serializeContributionReceipt,
  type ContributionReceipt,
} from './contribution-whatsapp'

interface AddCashContributionFormProps {
  groupId: GroupId
  groupName: string
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

function openWhatsAppPlaceholder(): Window | null {
  try {
    return window.open('about:blank', '_blank')
  } catch {
    return null
  }
}

export function AddCashContributionForm({
  groupId,
  groupName,
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
  const [receipt, setReceipt] = useState<ContributionReceipt | null>(() => {
    try {
      return parseContributionReceipt(sessionStorage.getItem(CONTRIBUTION_RECEIPT_STORAGE_KEY), groupId)
    } catch {
      return null
    }
  })
  const [receiptNotice, setReceiptNotice] = useState<string | null>(null)
  const isWaitingForConfirmation = pendingContribution !== null

  async function saveContribution(pending: PendingContribution) {
    setIsSaving(true)
    setReceiptNotice(null)
    const receiptWindow = openWhatsAppPlaceholder()

    try {
      let contribution: Contribution
      try {
        contribution = await new FirestoreV4OperationalFunctionsClient().createCashContribution(
          operationalPin,
          pending.input,
        )
      } catch (writeError) {
        // Una respuesta perdida no debe provocar que se repita una aportación que sí llegó a guardarse.
        let verifiedContribution: Contribution | undefined
        try {
          const verification = await new FirestoreV4GroupReadService(firestore).readGroup(groupId)
          verifiedContribution = verification.contributions.find((item) => item.id === pending.input.id)
        } catch {
          // Si tampoco se puede leer, se conserva el error original de escritura.
        }
        if (verifiedContribution === undefined) throw writeError
        contribution = verifiedContribution
      }

      let resultingBalanceInCents: number | undefined
      try {
        const savedEntities = await new FirestoreV4GroupReadService(firestore).readGroup(groupId)
        resultingBalanceInCents = createGroupFinancialView(savedEntities).personBalances
          .find((balance) => balance.personId === contribution.personId)?.availableInCents
      } catch {
        // El justificante sigue siendo válido; un saldo no verificado se omite deliberadamente.
      }

      let refreshFailed = false
      try {
        await onGroupChanged()
      } catch {
        refreshFailed = true
      }

      const savedReceipt: ContributionReceipt = {
        contributionId: contribution.id,
        groupId,
        personName: pending.personName,
        phone: pending.people.find((person) => person.id === contribution.personId)?.phone ?? '',
        groupName,
        date: contribution.date ?? pending.input.date,
        amountInCents: contribution.amountInCents,
        ...(resultingBalanceInCents === undefined ? {} : { balanceInCents: resultingBalanceInCents }),
      }
      setReceipt(savedReceipt)
      try {
        sessionStorage.setItem(CONTRIBUTION_RECEIPT_STORAGE_KEY, serializeContributionReceipt(savedReceipt))
      } catch {
        // La recuperación sigue disponible mientras esta pantalla permanezca abierta.
      }

      const resetValues = resetCashFormAfterSave(date)
      setPersonId(resetValues.personId)
      setAmountInEuros(resetValues.amountInEuros)
      setMessage(
        `Aportación de ${formatCurrency(contribution.amountInCents)} para ${pending.personName} guardada correctamente con fecha ${formatDate(contribution.date ?? date)}.${refreshFailed ? ' No se ha podido actualizar la pantalla; no vuelvas a registrar la aportación.' : ''}`,
      )

      const whatsAppUrl = contributionReceiptWhatsAppUrl(savedReceipt)
      if (whatsAppUrl === null) {
        receiptWindow?.close()
        setReceiptNotice('La aportación está guardada, pero la persona no tiene un teléfono válido. Puedes copiar el justificante.')
      } else if (receiptWindow === null) {
        setReceiptNotice('La aportación está guardada, pero el navegador ha bloqueado WhatsApp. Usa “Abrir WhatsApp” o copia el justificante.')
      } else {
        try {
          receiptWindow.location.replace(whatsAppUrl)
        } catch {
          receiptWindow.close()
          setReceiptNotice('La aportación está guardada, pero no se ha podido abrir WhatsApp. Usa “Abrir WhatsApp” o copia el justificante.')
        }
      }
    } catch (reason) {
      receiptWindow?.close()
      setError(
        reason instanceof Error
          ? `No se ha podido guardar la aportación: ${reason.message}`
          : 'No se ha podido guardar la aportación.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function copyReceipt() {
    if (receipt === null) return
    const text = contributionReceiptText(receipt)
    try {
      await navigator.clipboard.writeText(text)
      setReceiptNotice('Justificante copiado.')
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.append(textArea)
      textArea.select()
      const copied = document.execCommand('copy')
      textArea.remove()
      setReceiptNotice(copied ? 'Justificante copiado.' : 'No se ha podido copiar automáticamente. Selecciona el texto del justificante.')
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
      {receipt && <div className="contribution-receipt" aria-label="Último justificante de aportación">
        <strong>Último justificante guardado</strong>
        <pre>{contributionReceiptText(receipt)}</pre>
        <div>
          {contributionReceiptWhatsAppUrl(receipt) && <a href={contributionReceiptWhatsAppUrl(receipt) ?? undefined} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
          <button type="button" onClick={copyReceipt}>Copiar justificante</button>
        </div>
        {receiptNotice && <p role="status">{receiptNotice}</p>}
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
