import { Fragment, useEffect, useState } from 'react'
import type { Expense, Group, Person } from '../../domain/entities'
import {
  compactExpenseParticipants,
  expenseAllocationDetails,
  expenseDistributionLabel,
  visibleAdminExpenses,
  type AdminExpensePeriod,
} from './admin-expense-list'
import { FirestoreV4AdministrationFunctionsClient } from '../../infrastructure/functions/firestore-v4-administration-functions-client'
import { EditExpenseForm } from './EditExpenseForm'

interface ExpenseDeletionAdminProps {
  group: Group
  people: readonly Person[]
  expenses: readonly Expense[]
  onGroupChanged(): Promise<void>
  administrationPin: string
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amountInCents / 100)
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

/** Administración V4: consulta, edición y eliminación aisladas al grupo activo. */
export function ExpenseDeletionAdmin({ group, people, expenses, administrationPin, onGroupChanged }: ExpenseDeletionAdminProps) {
  const groupId = group.id
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null)
  const [period, setPeriod] = useState<AdminExpensePeriod>('current-month')
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedExpense(null)
    setEditingExpense(null)
    setViewingExpense(null)
    setPeriod('current-month')
    setMessage(null)
    setError(null)
  }, [groupId])

  const listedExpenses = visibleAdminExpenses(expenses, groupId, period)

  async function deleteSelectedExpense() {
    if (selectedExpense === null || selectedExpense.groupId !== groupId || isDeleting) return

    setMessage(null)
    setError(null)
    setIsDeleting(true)
    try {
      await new FirestoreV4AdministrationFunctionsClient().execute(administrationPin, 'deleteExpense', groupId, { expenseId: selectedExpense.id })
      await onGroupChanged()
      setMessage(`Gasto eliminado: ${selectedExpense.concept} (${formatCurrency(selectedExpense.totalInCents)}).`)
      setSelectedExpense(null)
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido eliminar el gasto: ${reason.message}` : 'No se ha podido eliminar el gasto.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="expense-deletion-admin" aria-labelledby="expense-deletion-admin-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Gastos</p>
          <h2 id="expense-deletion-admin-title">Gestionar gastos</h2>
        </div>
      </div>
      <div className="admin-expense-period">
        <p className="expense-deletion-note">{period === 'current-month' ? 'Mostrando únicamente los gastos del mes actual.' : 'Mostrando todos los gastos del grupo activo.'}</p>
        <button type="button" onClick={() => setPeriod((current) => current === 'current-month' ? 'all' : 'current-month')}>{period === 'current-month' ? 'Ver todos los gastos' : 'Ver mes actual'}</button>
      </div>

      {listedExpenses.length === 0 ? <p className="history-empty-state">{period === 'current-month' ? 'No hay gastos en el mes actual.' : 'Este grupo no tiene gastos.'}</p> : <ul className="admin-expense-list">
        {listedExpenses.map((expense) => {
          const participants = compactExpenseParticipants(expense, people)
          return <Fragment key={expense.id}>
            <li className="admin-expense-card">
              <div className="admin-expense-card-main">
                <div className="admin-expense-card-title"><strong>{expense.siteName}</strong><span>{expense.concept}</span></div>
                <div className="admin-expense-card-meta"><span>{formatDate(expense.date)}</span><span>{expense.participantIds.length} participantes</span><span>{expenseDistributionLabel(expense.distribution.mode)}</span></div>
                <p className="admin-expense-card-participants">{participants.visibleNames.join(', ')}{participants.extraCount > 0 && <span> +{participants.extraCount} más</span>}</p>
              </div>
              <div className="admin-expense-card-actions">
                <strong>{formatCurrency(expense.totalInCents)}</strong>
                <div>
                  <button type="button" className="admin-expense-detail-button" onClick={() => { setViewingExpense(expense); setEditingExpense(null); setSelectedExpense(null) }}>Ver detalle</button>
                  <button type="button" disabled={isDeleting} onClick={() => { setEditingExpense(expense); setSelectedExpense(null); setViewingExpense(null) }}>Editar</button>
                  <button type="button" disabled={isDeleting} onClick={() => { setSelectedExpense(expense); setEditingExpense(null); setViewingExpense(null) }}>Eliminar</button>
                </div>
              </div>
            </li>
            {editingExpense?.id === expense.id && <li className="admin-expense-inline-editor">
              <EditExpenseForm
                group={group}
                people={people}
                expense={editingExpense}
                administrationPin={administrationPin}
                onGroupChanged={onGroupChanged}
                onClose={() => setEditingExpense(null)}
                onSaved={(updatedExpense) => {
                  setEditingExpense(null)
                  setMessage(`Gasto actualizado: ${updatedExpense.concept} (${formatCurrency(updatedExpense.totalInCents)}).`)
                }}
              />
            </li>}
          </Fragment>
        })}
      </ul>}

      {viewingExpense && (
        <aside className="expense-detail-modal" role="dialog" aria-modal="true" aria-labelledby="expense-detail-title">
          <div className="expense-detail-panel">
            <header><div><p className="eyebrow">Detalle de gasto</p><h3 id="expense-detail-title">{viewingExpense.siteName}</h3></div><button type="button" onClick={() => setViewingExpense(null)}>Cerrar</button></header>
            <dl className="expense-detail-summary">
              <div><dt>Fecha</dt><dd>{formatDate(viewingExpense.date)}</dd></div>
              <div><dt>Concepto</dt><dd>{viewingExpense.concept}</dd></div>
              <div><dt>Importe total</dt><dd>{formatCurrency(viewingExpense.totalInCents)}</dd></div>
              <div><dt>Reparto</dt><dd>{expenseDistributionLabel(viewingExpense.distribution.mode)}</dd></div>
            </dl>
            <div className="expense-detail-allocations"><strong>Participantes y asignación final</strong><ul>{expenseAllocationDetails(viewingExpense, people).map((allocation) => <li key={allocation.personId}><span>{allocation.personName}</span><strong>{formatCurrency(allocation.amountInCents)}</strong></li>)}</ul></div>
          </div>
        </aside>
      )}

      {selectedExpense && (
        <div className="expense-delete-confirmation" role="alert">
          <p>Vas a eliminar este gasto:</p>
          <strong>{formatDate(selectedExpense.date)} · {selectedExpense.siteName} · {selectedExpense.concept} · {formatCurrency(selectedExpense.totalInCents)}</strong>
          <div>
            <button type="button" disabled={isDeleting} onClick={() => setSelectedExpense(null)}>Cancelar</button>
            <button type="button" disabled={isDeleting} onClick={() => void deleteSelectedExpense()}>{isDeleting ? 'Eliminando…' : 'Confirmar eliminación'}</button>
          </div>
        </div>
      )}

      {message && <p className="operation-message">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}


