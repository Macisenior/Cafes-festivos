import { useEffect, useState, type FormEvent } from 'react'
import type { Firestore } from 'firebase/firestore'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { FirestoreV4AdministrationFunctionsClient } from '../../infrastructure/functions/firestore-v4-administration-functions-client'
import { eurosToCents } from '../aportaciones/cash-contribution-request'
import { formatPdfMoney, formatPdfDate } from './historical-pdf'
import { getManageableProSummaryContribution } from './pro-summary-contribution-actions'
import { toggleProSummaryDetail } from './pro-summary-details'
import { createProSummary } from './pro-summary'

interface ProSummaryReportProps {
  group: Group
  people: readonly Person[]
  contributions: readonly Contribution[]
  expenses: readonly Expense[]
  firestore: Firestore
  administrationPin: string
  onGroupChanged(): Promise<void>
}

interface ContributionActionTarget {
  id: string
  personName: string
  date: string
  amountInCents: number
}

function centsToEurosInput(amountInCents: number): string {
  return (amountInCents / 100).toFixed(2).replace('.', ',')
}

export function ProSummaryReport({
  group,
  people,
  contributions,
  expenses,
  administrationPin,
  onGroupChanged,
}: ProSummaryReportProps) {
  const [expandedPersonIds, setExpandedPersonIds] = useState<readonly string[]>([])
  const [editingContribution, setEditingContribution] = useState<ContributionActionTarget | null>(null)
  const [deletingContribution, setDeletingContribution] = useState<ContributionActionTarget | null>(null)
  const [amountInEuros, setAmountInEuros] = useState('')
  const [date, setDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const summary = createProSummary(group, people, contributions, expenses)

  useEffect(() => {
    setExpandedPersonIds([])
    setEditingContribution(null)
    setDeletingContribution(null)
    setMessage(null)
    setError(null)
  }, [group.id])

  function openEdit(target: ContributionActionTarget) {
    if (isSaving) return
    setMessage(null)
    setError(null)
    setDeletingContribution(null)
    setEditingContribution(target)
    setDate(target.date)
    setAmountInEuros(centsToEurosInput(target.amountInCents))
  }

  function openDelete(target: ContributionActionTarget) {
    if (isSaving) return
    setMessage(null)
    setError(null)
    setEditingContribution(null)
    setDeletingContribution(target)
  }

  async function saveEdition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingContribution === null || isSaving) return

    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      getManageableProSummaryContribution(contributions, group.id, editingContribution.id)
      await new FirestoreV4AdministrationFunctionsClient().execute(
        administrationPin,
        'editContribution',
        group.id,
        { edition: { id: editingContribution.id, amountInCents: eurosToCents(amountInEuros), date } },
      )
      await onGroupChanged()
      setEditingContribution(null)
      setMessage(`Aportación de ${editingContribution.personName} actualizada correctamente.`)
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido editar la aportación: ${reason.message}` : 'No se ha podido editar la aportación.')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDeletion() {
    if (deletingContribution === null || isSaving) return

    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      getManageableProSummaryContribution(contributions, group.id, deletingContribution.id)
      await new FirestoreV4AdministrationFunctionsClient().execute(
        administrationPin,
        'deleteContribution',
        group.id,
        { contributionId: deletingContribution.id },
      )
      await onGroupChanged()
      setDeletingContribution(null)
      setMessage(`Aportación de ${deletingContribution.personName} eliminada correctamente.`)
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido borrar la aportación: ${reason.message}` : 'No se ha podido borrar la aportación.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="operational-history" aria-labelledby="pro-summary-title">
      <div className="section-heading"><div><p className="eyebrow">Informes</p><h2 id="pro-summary-title">Resumen PRO</h2><p className="history-group-name">Grupo: {group.name}</p></div></div>
      {summary.length === 0 ? <p className="history-empty-state">Este grupo no tiene personas para resumir.</p> : <div className="pro-summary-list">
        {summary.map((person) => {
          const isExpanded = expandedPersonIds.includes(person.personId)
          return <article className="pro-summary-card" key={person.personId}>
            <button type="button" className="pro-summary-toggle" aria-expanded={isExpanded} onClick={() => setExpandedPersonIds((current) => toggleProSummaryDetail(current, person.personId))}>
              <span><strong>{person.name}</strong><small>{person.isActive ? 'Activa' : 'Inactiva'}</small></span>
              <span className={person.balanceInCents > 0 ? 'positive' : person.balanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(person.balanceInCents)}</span>
            </button>
            {isExpanded && <div className="pro-summary-detail">
              {person.datedContributions.map((contribution) => <div className="pro-summary-contribution" key={contribution.id}>
                <p><span>{formatPdfDate(contribution.date)} · Aportación</span><span>{formatPdfMoney(contribution.amountInCents)}</span></p>
                <div className="pro-summary-contribution-actions">
                  <button type="button" disabled={isSaving} onClick={() => openEdit({ ...contribution, personName: person.name })}>Editar</button>
                  <button type="button" disabled={isSaving} onClick={() => openDelete({ ...contribution, personName: person.name })}>Borrar</button>
                </div>
                {editingContribution?.id === contribution.id && <form className="pro-summary-contribution-form" onSubmit={saveEdition}>
                  <label>Importe (€)<input value={amountInEuros} onChange={(event) => setAmountInEuros(event.target.value)} inputMode="decimal" disabled={isSaving} required /></label>
                  <label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={isSaving} required /></label>
                  <div><button type="button" disabled={isSaving} onClick={() => setEditingContribution(null)}>Cancelar</button><button type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar aportación'}</button></div>
                </form>}
              </div>)}

              {person.openingContributions.map((contribution) => <p key={contribution.id}><strong>Inicio</strong><span>{formatPdfMoney(contribution.amountInCents)}</span></p>)}
              {person.openingContributions.length === 0 && person.datedContributions.length === 0 && <p>Sin aportaciones registradas.</p>}
              <p><strong>Total aportado</strong><strong>{formatPdfMoney(person.totalContributedInCents)}</strong></p>
              <p><strong>Total gastado</strong><strong>{formatPdfMoney(person.totalSpentInCents)}</strong></p>
              <p className="pro-summary-balance"><strong>Saldo actual</strong><strong className={person.balanceInCents > 0 ? 'positive' : person.balanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(person.balanceInCents)}</strong></p>
            </div>}
          </article>
        })}
      </div>}
      {deletingContribution && <div className="pro-summary-delete-confirmation" role="alert">
        <p>Vas a borrar definitivamente la aportación de {deletingContribution.personName} del {formatPdfDate(deletingContribution.date)} por {formatPdfMoney(deletingContribution.amountInCents)}.</p>
        <div><button type="button" disabled={isSaving} onClick={() => setDeletingContribution(null)}>Cancelar</button><button type="button" disabled={isSaving} onClick={confirmDeletion}>{isSaving ? 'Borrando…' : 'Confirmar borrado'}</button></div>
      </div>}
      {message && <p className="operation-message">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}


