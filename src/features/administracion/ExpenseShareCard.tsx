import { forwardRef } from 'react'
import type { ExpenseShareCardData } from './expense-share-card'
import { formatPdfMoney } from './historical-pdf'

interface ExpenseShareCardProps {
  detail: ExpenseShareCardData
}

/** Tarjeta aislada para PNG: solo información del gasto, sin controles de interfaz. */
export const ExpenseShareCard = forwardRef<HTMLDivElement, ExpenseShareCardProps>(function ExpenseShareCard({ detail }, ref) {
  return <article ref={ref} className="expense-share-card">
    <header><p>GASTOS DEL GRUPO</p><h2>{detail.groupName}</h2></header>
    <section className="expense-share-card-title"><p>Detalle de gasto</p><h3>{detail.siteName}</h3><span>{detail.concept}</span></section>
    <dl className="expense-share-card-summary">
      <div><dt>Fecha</dt><dd>{detail.formattedDate}</dd></div>
      <div><dt>Importe total</dt><dd>{detail.formattedTotal}</dd></div>
      <div><dt>Reparto</dt><dd>{detail.distributionLabel}</dd></div>
    </dl>
    <section className="expense-share-card-allocations"><strong>Participantes y asignación final</strong><ul>{detail.allocations.map((allocation) => <li key={allocation.personId}><span>{allocation.personName}</span><strong>{formatPdfMoney(allocation.amountInCents)}</strong></li>)}</ul></section>
  </article>
})

ExpenseShareCard.displayName = 'ExpenseShareCard'