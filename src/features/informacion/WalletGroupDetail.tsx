import type { WalletGroupDetail } from './wallet-group-detail'
import { formatPdfDate, formatPdfMoney } from '../administracion/historical-pdf'

interface WalletGroupDetailProps {
  detail: WalletGroupDetail
}

function movementLabel(kind: 'contribution' | 'expense'): string {
  return kind === 'contribution' ? 'Aportación' : 'Gasto'
}

export function WalletGroupDetail({ detail }: WalletGroupDetailProps) {
  return (
    <div className="wallet-group-detail">
      <dl className="wallet-group-metrics">
        <div><dt>Saldo del grupo</dt><dd>{formatPdfMoney(detail.balanceInCents)}</dd></div>
        {detail.selectedPersonBalanceInCents !== null && <div><dt>Tu saldo</dt><dd>{formatPdfMoney(detail.selectedPersonBalanceInCents)}</dd></div>}
        <div><dt>Personas activas</dt><dd>{detail.activePeopleCount}</dd></div>
      </dl>
      {detail.latestMovement === null && detail.latestContribution === null ? (
        <p className="wallet-group-empty">Sin movimientos fechados todavía.</p>
      ) : (
        <div className="wallet-group-latest">
          {detail.latestMovement !== null && <Movement title="Último movimiento" movement={detail.latestMovement} />}
          {detail.latestContribution !== null && <Movement title="Última aportación" movement={detail.latestContribution} />}
        </div>
      )}
    </div>
  )
}

function Movement({ title, movement }: { title: string; movement: NonNullable<WalletGroupDetail['latestMovement']> }) {
  return (
    <div className="wallet-group-movement">
      <span>{title}</span>
      <strong>{movement.title}</strong>
      <small>{formatPdfDate(movement.date)} · {movementLabel(movement.kind)}</small>
      <em>{formatPdfMoney(movement.amountInCents)}</em>
    </div>
  )
}
