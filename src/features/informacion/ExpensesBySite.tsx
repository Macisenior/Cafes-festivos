import type { Expense, GroupId } from '../../domain/entities'
import { ExpenseSiteDonut } from './ExpenseSiteDonut'
import { createExpensesBySite } from './expenses-by-site'

interface ExpensesBySiteProps {
  groupId: GroupId
  expenses: readonly Expense[]
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amountInCents / 100)
}

function formatPercentage(percentage: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(percentage)
}

/** Consulta visual: reutiliza los segmentos exactos V4 y no recalcula gastos ni repartos. */
export function ExpensesBySite({ groupId, expenses }: ExpensesBySiteProps) {
  const segments = createExpensesBySite(groupId, expenses)

  return (
    <section className="expenses-by-site" aria-labelledby="expenses-by-site-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Consulta</p>
          <h2 id="expenses-by-site-title">Gasto por sitio</h2>
        </div>
        <span className="people-count">{segments.length} sitios</span>
      </div>
      {segments.length === 0 ? (
        <p className="empty-state">Todavía no hay gastos válidos registrados para este grupo.</p>
      ) : (
        <ExpenseSiteDonut segments={segments} formatCurrency={formatCurrency} formatPercentage={formatPercentage} />
      )}
    </section>
  )
}
