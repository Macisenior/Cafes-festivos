import { useEffect, useState, type FormEvent } from 'react'
import type { Expense, Group, Person } from '../../domain/entities'
import type { ExpenseDistributionMode, PersonId } from '../../domain/reparto'
import { FirestoreV4AdministrationFunctionsClient } from '../../infrastructure/functions/firestore-v4-administration-functions-client'
import { eurosToCents } from '../aportaciones/cash-contribution-request'
import {
  individualAmountsInCents,
  summarizeIndividualAmounts,
  type IndividualAmountSummary,
} from '../gastos/expense-form-inputs'

interface EditExpenseFormProps {
  group: Group
  people: readonly Person[]
  expense: Expense
  administrationPin: string
  onGroupChanged(): Promise<void>
  onSaved(expense: Expense): void
  onClose(): void
}

function centsToInput(amountInCents: number): string {
  const absoluteAmount = Math.abs(amountInCents)
  return `${amountInCents < 0 ? '-' : ''}${Math.floor(absoluteAmount / 100)},${String(absoluteAmount % 100).padStart(2, '0')}`
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amountInCents / 100)
}

function distributionValues(expense: Expense): {
  mode: ExpenseDistributionMode
  consumptions: Readonly<Record<PersonId, string>>
  individualAmounts: Readonly<Record<PersonId, string>>
} {
  switch (expense.distribution.mode) {
    case 'igual':
      return { mode: 'igual', consumptions: {}, individualAmounts: {} }
    case 'consumiciones':
      {
        const consumptionsByPersonId = expense.distribution.consumptionsByPersonId
      return {
        mode: 'consumiciones',
        consumptions: Object.fromEntries(
          expense.participantIds.map((personId) => [personId, String(consumptionsByPersonId[personId] ?? '')]),
        ),
        individualAmounts: {},
      }
      }
    case 'importe':
      {
        const amountsByPersonId = expense.distribution.amountsByPersonId
      return {
        mode: 'importe',
        consumptions: {},
        individualAmounts: Object.fromEntries(
          expense.participantIds.map((personId) => [personId, centsToInput(amountsByPersonId[personId] ?? 0)]),
        ),
      }
      }
  }
}

/** Editor administrativo: solo prepara datos; el dominio vuelve a calcular el reparto final. */
export function EditExpenseForm({
  group,
  people,
  expense,
  administrationPin,
  onGroupChanged,
  onSaved,
  onClose,
}: EditExpenseFormProps) {
  const [date, setDate] = useState(expense.date)
  const [siteName, setSiteName] = useState(expense.siteName)
  const [concept, setConcept] = useState(expense.concept)
  const [totalInEuros, setTotalInEuros] = useState(centsToInput(expense.totalInCents))
  const [participantIds, setParticipantIds] = useState<readonly PersonId[]>(expense.participantIds)
  const initialDistribution = distributionValues(expense)
  const [mode, setMode] = useState<ExpenseDistributionMode>(initialDistribution.mode)
  const [consumptions, setConsumptions] = useState<Readonly<Record<PersonId, string>>>(initialDistribution.consumptions)
  const [individualAmounts, setIndividualAmounts] = useState<Readonly<Record<PersonId, string>>>(initialDistribution.individualAmounts)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const values = distributionValues(expense)
    setDate(expense.date)
    setSiteName(expense.siteName)
    setConcept(expense.concept)
    setTotalInEuros(centsToInput(expense.totalInCents))
    setParticipantIds(expense.participantIds)
    setMode(values.mode)
    setConsumptions(values.consumptions)
    setIndividualAmounts(values.individualAmounts)
    setError(null)
  }, [expense])

  const selectablePeople = people.filter(
    (person) => person.groupId === group.id && (person.isActive || expense.participantIds.includes(person.id)),
  )

  function personName(personId: PersonId): string {
    return selectablePeople.find((person) => person.id === personId)?.name ?? personId
  }

  function toggleParticipant(personId: PersonId, isSelected: boolean) {
    setParticipantIds((current) => isSelected ? [...current, personId] : current.filter((id) => id !== personId))
    if (isSelected) {
      setConsumptions((current) => ({ ...current, [personId]: current[personId] ?? '1' }))
      setIndividualAmounts((current) => ({ ...current, [personId]: current[personId] ?? '' }))
    }
  }

  function createDistribution() {
    switch (mode) {
      case 'igual':
        return { mode: 'igual' as const }
      case 'consumiciones':
        return {
          mode: 'consumiciones' as const,
          consumptionsByPersonId: Object.fromEntries(
            participantIds.map((personId) => [personId, Number(consumptions[personId] ?? '')]),
          ),
        }
      case 'importe':
        return {
          mode: 'importe' as const,
          amountsByPersonId: individualAmountsInCents(participantIds, individualAmounts),
        }
    }
  }

  let individualSummary: IndividualAmountSummary | null = null
  if (mode === 'importe' && participantIds.length > 0) {
    try {
      individualSummary = summarizeIndividualAmounts(totalInEuros, participantIds, individualAmounts)
    } catch {
      individualSummary = null
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return

    setError(null)
    setIsSaving(true)
    try {
      const updatedExpense = await new FirestoreV4AdministrationFunctionsClient().execute<Expense>(
        administrationPin,
        'editExpense',
        group.id,
        {
          expenseId: expense.id,
          input: {
            date,
            siteName,
            concept,
            totalInCents: eurosToCents(totalInEuros),
            participantIds,
            distribution: createDistribution(),
          },
        },
      )
      await onGroupChanged()
      onSaved(updatedExpense)
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido actualizar el gasto: ${reason.message}` : 'No se ha podido actualizar el gasto.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="expense-section" aria-labelledby="edit-expense-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Gastos</p>
          <h2 id="edit-expense-title">Editar gasto</h2>
        </div>
        <button type="button" disabled={isSaving} onClick={onClose}>Cerrar edición</button>
      </div>
      <form className="expense-form" onSubmit={handleSubmit}>
        <label>Fecha<input type="date" value={date} disabled={isSaving} onChange={(event) => setDate(event.target.value)} required /></label>
        <label>Sitio<select value={siteName} disabled={isSaving} onChange={(event) => setSiteName(event.target.value)} required><option value="">Selecciona un sitio</option>{group.siteOptions.map((site) => <option key={site.id} value={site.name}>{site.name}</option>)}</select></label>
        <label>Concepto<input value={concept} disabled={isSaving} onChange={(event) => setConcept(event.target.value)} required /></label>
        <label>Importe total (€)<input value={totalInEuros} disabled={isSaving} onChange={(event) => setTotalInEuros(event.target.value)} inputMode="decimal" placeholder="0,00" required /></label>
        <fieldset disabled={isSaving}>
          <legend>Participantes</legend>
          {selectablePeople.map((person) => <label key={person.id}><input type="checkbox" checked={participantIds.includes(person.id)} onChange={(event) => toggleParticipant(person.id, event.target.checked)} />{person.name}{!person.isActive ? ' (inactiva histórica)' : ''}</label>)}
        </fieldset>
        <label>Reparto<select value={mode} disabled={isSaving} onChange={(event) => setMode(event.target.value as ExpenseDistributionMode)}><option value="igual">Igual</option><option value="consumiciones">Consumiciones</option><option value="importe">Importe por persona</option></select></label>
        {mode === 'consumiciones' && <div className="distribution-fields">{participantIds.map((personId) => <label key={personId}>Consumiciones de {personName(personId)}<input type="number" min="1" step="1" disabled={isSaving} required value={consumptions[personId] ?? ''} onChange={(event) => setConsumptions((current) => ({ ...current, [personId]: event.target.value }))} /></label>)}</div>}
        {mode === 'importe' && <div className="distribution-fields">{participantIds.map((personId) => <label key={personId}>Importe de {personName(personId)} (€)<input inputMode="decimal" disabled={isSaving} required value={individualAmounts[personId] ?? ''} onChange={(event) => setIndividualAmounts((current) => ({ ...current, [personId]: event.target.value }))} /></label>)}</div>}
        {mode === 'importe' && individualSummary && <p className={`individual-amount-summary ${individualSummary.matchesTotal ? 'matches' : 'mismatch'}`}>Suma individual: {formatCurrency(individualSummary.assignedInCents)} · Total: {formatCurrency(individualSummary.totalInCents)}{individualSummary.matchesTotal ? ' ✓' : ' — debe coincidir exactamente'}</p>}
        <button type="submit" disabled={isSaving || (mode === 'importe' && individualSummary !== null && !individualSummary.matchesTotal)}>{isSaving ? 'Guardando…' : 'Guardar cambios'}</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}


