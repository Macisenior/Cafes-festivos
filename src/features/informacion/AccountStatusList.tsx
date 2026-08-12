import { useEffect, useState } from 'react'
import type { GroupFinancialEntities, GroupFinancialView } from '../../domain/financial-adapter'
import { formatPdfDate, formatPdfMoney } from '../administracion/historical-pdf'
import { createPendingBalanceWhatsAppUrl } from './account-whatsapp'
import { createPersonAccountSummary } from './person-account-summary'

interface AccountStatusListProps {
  entities: GroupFinancialEntities
  financialView: GroupFinancialView
  selectedPersonId: string | null
}

function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amountInCents / 100)
}

function personStatus(balanceInCents: number): { label: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (balanceInCents > 0) return { label: 'A favor', tone: 'positive' }
  if (balanceInCents < 0) return { label: 'Pendiente', tone: 'negative' }
  return { label: 'Equilibrado', tone: 'neutral' }
}

export function AccountStatusList({ entities, financialView, selectedPersonId }: AccountStatusListProps) {
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const balancesByPersonId = new Map(financialView.personBalances.map((balance) => [balance.personId, balance]))

  useEffect(() => { setExpandedPersonId(null) }, [entities.group.id])

  return (
    <section className="accounts-section information-accounts" aria-labelledby="accounts-title">
      <div className="section-heading">
        <div><p className="eyebrow">El grupo, persona a persona</p><h2 id="accounts-title">Estado de cuentas</h2></div>
        <span className="people-count">{entities.people.length} personas</span>
      </div>
      <ul className="account-list">
        {entities.people.map((person) => {
          const balance = balancesByPersonId.get(person.id)
          if (balance === undefined) return null
          const accountStatus = personStatus(balance.availableInCents)
          const isExpanded = expandedPersonId === person.id
          const isCurrentUser = selectedPersonId === person.id
          const detail = isExpanded ? createPersonAccountSummary(
            entities.group.id,
            person.id,
            balance,
            entities.people,
            entities.contributions,
            entities.expenses,
          ) : null
          const whatsAppUrl = createPendingBalanceWhatsAppUrl(
            person.name,
            person.phone,
            balance.availableInCents,
            entities.group.name,
          )
          return <li className={`account-card account-card--${accountStatus.tone}${isCurrentUser ? ' is-current-user' : ''}${isExpanded ? ' is-expanded' : ''}`} key={person.id}>
            <div className="information-account-row">
              <button type="button" className="information-account-toggle" aria-expanded={isExpanded} onClick={() => setExpandedPersonId((current) => current === person.id ? null : person.id)}>
                <span className="information-account-person"><span className={`information-account-dot ${accountStatus.tone}`} aria-hidden="true" /><span><span className="information-account-name-row"><strong>{person.name}</strong></span><small className={`account-status ${accountStatus.tone}`}>{accountStatus.label}</small></span></span>
                <span className={`person-balance ${accountStatus.tone}`}>{formatCurrency(balance.availableInCents)}</span>
              </button>
              {whatsAppUrl && <a className="information-account-whatsapp" href={whatsAppUrl} target="_blank" rel="noreferrer" aria-label={`Preparar mensaje de WhatsApp para ${person.name}`}>◉<span>WhatsApp</span></a>}
            </div>
            {detail && <div className="information-account-detail">
              <div className="information-account-totals"><span>Total aportado<strong>{formatPdfMoney(detail.contributedInCents)}</strong></span><span>Total gastado<strong>{formatPdfMoney(detail.spentInCents)}</strong></span><span>Saldo actual<strong className={detail.balanceInCents > 0 ? 'positive' : detail.balanceInCents < 0 ? 'negative' : ''}>{formatPdfMoney(detail.balanceInCents)}</strong></span></div>
              <div className="information-account-recent"><p>Últimos movimientos</p>{detail.recentMovements.length === 0 ? <span>Sin movimientos registrados.</span> : <ul>{detail.recentMovements.map((movement) => <li key={`${movement.kind}-${movement.id}`}><span><strong>{movement.title}</strong><small>{movement.date === null ? 'Sin fecha histórica' : formatPdfDate(movement.date)} · {movement.kind === 'expense' ? 'Gasto asignado' : movement.isInheritedOpening ? 'Apertura heredada' : 'Aportación'}</small></span><strong className={movement.kind === 'expense' ? 'negative' : 'positive'}>{movement.kind === 'expense' ? '−' : '+'}{formatPdfMoney(movement.amountInCents)}</strong></li>)}</ul>}</div>
            </div>}
          </li>
        })}
      </ul>
    </section>
  )
}
