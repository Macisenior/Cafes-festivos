import { useState, type FormEvent } from 'react'
import type { Expense, Group, Person } from '../../domain/entities'
import type { ExpenseDistributionMode, PersonId } from '../../domain/reparto'
import { FirestoreV4OperationalFunctionsClient } from '../../infrastructure/functions/firestore-v4-operational-functions-client'
import { createHistoricalSiteSuggestions } from './historical-site-suggestions'

import { eurosToCents } from '../aportaciones/cash-contribution-request'
import {
  individualAmountsInCents,
  previewIndividualAmounts,
  summarizeIndividualAmounts,
  type IndividualAmountSummary,
} from './expense-form-inputs'

const MAIN_SITES = ['Flap', 'Colono', 'Lydo'] as const

interface AddExpenseFormProps {
  group: Group
  people: readonly Person[]
  expenses: readonly Expense[]
  operationalPin: string
  onGroupChanged(): Promise<void>
}

function todayInMadrid(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amountInCents / 100)
}

export function AddExpenseForm({ group, people, expenses, operationalPin, onGroupChanged }: AddExpenseFormProps) {
  const activePeople = people.filter((person) => person.groupId === group.id && person.isActive)
  const historicalSiteSuggestions = createHistoricalSiteSuggestions(group.id, expenses, MAIN_SITES)
  const [date, setDate] = useState(todayInMadrid)
  const [siteName, setSiteName] = useState('')
  const [selectedMainSite, setSelectedMainSite] = useState<string | null>(null)
  const [concept, setConcept] = useState('')
  const [totalInEuros, setTotalInEuros] = useState('')
  const [participantIds, setParticipantIds] = useState<readonly PersonId[]>([])
  const [mode, setMode] = useState<ExpenseDistributionMode>('igual')
  const [consumptions, setConsumptions] = useState<Readonly<Record<PersonId, string>>>({})
  const [individualAmounts, setIndividualAmounts] = useState<Readonly<Record<PersonId, string>>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleParticipant(personId: PersonId, isSelected: boolean) {
    setParticipantIds((current) =>
      isSelected ? [...current, personId] : current.filter((currentPersonId) => currentPersonId !== personId),
    )
    if (isSelected) {
      setConsumptions((current) => ({ ...current, [personId]: current[personId] ?? '1' }))
      setIndividualAmounts((current) => ({ ...current, [personId]: current[personId] ?? '' }))
    }
  }

  function selectAllParticipants() {
    setParticipantIds(activePeople.map((person) => person.id))
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

  const individualFeedback = mode === 'importe' && participantIds.length > 0
    ? previewIndividualAmounts(totalInEuros, participantIds, individualAmounts)
    : null

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

    setMessage(null)
    setError(null)
    setIsSaving(true)

    try {
      const expense = await new FirestoreV4OperationalFunctionsClient().createExpense(operationalPin, {
        id: `v4-expense-${crypto.randomUUID()}`,
        groupId: group.id,
        date,
        siteName,
        concept,
        totalInCents: eurosToCents(totalInEuros),
        participantIds,
        distribution: createDistribution(),
      })
      await onGroupChanged()

      setSiteName('')
      setConcept('')
      setTotalInEuros('')
      setParticipantIds([])
      setConsumptions({})
      setIndividualAmounts({})
      setMessage(
        `Gasto de ${formatCurrency(expense.totalInCents)} guardado correctamente. Los saldos se han actualizado.`,
      )
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido guardar el gasto: ${reason.message}` : 'No se ha podido guardar el gasto.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="expense-section" aria-labelledby="expense-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Gasto</p>
          <h2 id="expense-title">Añadir gasto</h2>
        </div>
      </div>

      <form className="expense-form" onSubmit={handleSubmit}>
        <label>Fecha<input type="date" value={date} disabled={isSaving} onChange={(event) => setDate(event.target.value)} required /></label>
        <fieldset className="expense-site-picker" disabled={isSaving}>
          <legend>Sitio</legend>
          <div className="expense-site-chips">{MAIN_SITES.map((site) => <button key={site} type="button" className={`expense-site-chip expense-site-chip--${site.toLowerCase()} ${selectedMainSite === site ? 'is-selected' : ''}`} onClick={() => { setSiteName(site); setSelectedMainSite(site) }}>{site}</button>)}</div>
          <label>Otro sitio…<input list="historical-site-suggestions" value={siteName} onChange={(event) => { setSiteName(event.target.value); setSelectedMainSite(null) }} placeholder="Escribe o reutiliza un sitio" /></label>
          {historicalSiteSuggestions.length > 0 && <datalist id="historical-site-suggestions">{historicalSiteSuggestions.map((siteName) => <option key={siteName} value={siteName} />)}</datalist>}
        </fieldset>
        <label>Concepto<input value={concept} disabled={isSaving} onChange={(event) => setConcept(event.target.value)} required /></label>
        <label>Importe total (€)<input value={totalInEuros} disabled={isSaving} onChange={(event) => setTotalInEuros(event.target.value)} inputMode="decimal" placeholder="0,00" required /></label>
        <fieldset className="expense-participants-picker" disabled={isSaving}>
          <legend>Participantes ({participantIds.length} de {activePeople.length})</legend>
          <button className="expense-select-all" type="button" onClick={selectAllParticipants}>Seleccionar todos</button>
          <div className="expense-participant-grid">{activePeople.map((person) => { const isSelected = participantIds.includes(person.id); return <label key={person.id} className={`expense-participant-chip ${isSelected ? 'is-selected' : ''}`}><input type="checkbox" checked={isSelected} onChange={(event) => toggleParticipant(person.id, event.target.checked)} /><span>{person.name}</span><b aria-hidden="true">✓</b></label> })}</div>
        </fieldset>
        <label>Reparto<select value={mode} disabled={isSaving} onChange={(event) => setMode(event.target.value as ExpenseDistributionMode)}><option value="igual">Igual</option><option value="consumiciones">Consumiciones</option><option value="importe">Importe por persona</option></select></label>
        {mode === 'consumiciones' && <div className="distribution-fields">{participantIds.map((personId) => <label key={personId}>Consumiciones de {activePeople.find((person) => person.id === personId)?.name}<input type="number" min="1" step="1" disabled={isSaving} required value={consumptions[personId] ?? ''} onChange={(event) => setConsumptions((current) => ({ ...current, [personId]: event.target.value }))} /></label>)}</div>}
        {mode === 'importe' && <div className="distribution-fields">{participantIds.map((personId) => <label key={personId}>Importe de {activePeople.find((person) => person.id === personId)?.name} (€)<input inputMode="decimal" disabled={isSaving} required value={individualAmounts[personId] ?? ''} onChange={(event) => setIndividualAmounts((current) => ({ ...current, [personId]: event.target.value }))} /></label>)}</div>}
        {mode === 'importe' && individualFeedback && <p className={`individual-amount-summary ${individualFeedback.status === 'matches' ? 'matches' : 'mismatch'}`}>Suma individual: {formatCurrency(individualFeedback.assignedInCents)} · Total: {individualFeedback.totalInCents === null ? '—' : formatCurrency(individualFeedback.totalInCents)}{individualFeedback.status === 'matches' ? ' ✓' : individualFeedback.status === 'missing' ? ` · Faltan ${formatCurrency(individualFeedback.differenceInCents ?? 0)}` : individualFeedback.status === 'excess' ? ` · Sobran ${formatCurrency(Math.abs(individualFeedback.differenceInCents ?? 0))}` : ' · Introduce un total válido'}</p>}
        <button type="submit" disabled={isSaving || (mode === 'importe' && individualSummary?.matchesTotal !== true)}>{isSaving ? 'Guardando…' : 'Añadir gasto'}</button>
      </form>
      {message && <p className="operation-message">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
