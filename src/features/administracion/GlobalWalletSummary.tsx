import { useEffect, useState } from 'react'
import type { Firestore } from 'firebase/firestore'
import type { GlobalFinancialView, GroupFinancialEntities } from '../../domain/financial-adapter'
import type { GroupId } from '../../domain/entities'
import { FirestoreV4GroupReadService } from '../../infrastructure/firestore/firestore-v4-group-read-service'
import { FirestoreV4GlobalWalletReadService } from '../../infrastructure/firestore/firestore-v4-global-wallet-read-service'
import { WalletGroupDetail } from '../informacion/WalletGroupDetail'
import { createWalletGroupDetail, toggleWalletGroupDetail } from '../informacion/wallet-group-detail'
import { formatPdfMoney } from './historical-pdf'
import { createGlobalWalletSummary, type GlobalWalletSummary as GlobalWalletSummaryData } from './global-wallet-summary'

type GlobalWalletPresentation = 'administration' | 'information'

interface GlobalWalletSummaryProps {
  firestore: Firestore
  activeGroupId: GroupId
  selectedPersonId?: string | null
  presentation?: GlobalWalletPresentation
}

interface LoadedWallet {
  summary: GlobalWalletSummaryData
  entities: readonly GroupFinancialEntities[]
  financialView: GlobalFinancialView
}

function balanceTone(amountInCents: number): 'positive' | 'negative' | 'neutral' {
  if (amountInCents > 0) return 'positive'
  if (amountInCents < 0) return 'negative'
  return 'neutral'
}

function groupInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('es-ES') || 'G'
}

export function GlobalWalletSummary({ firestore, activeGroupId, selectedPersonId = null, presentation = 'administration' }: GlobalWalletSummaryProps) {
  const [wallet, setWallet] = useState<LoadedWallet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [expandedGroupId, setExpandedGroupId] = useState<GroupId | null>(null)
  const isInformation = presentation === 'information'

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const reader = new FirestoreV4GroupReadService(firestore)
        const result = await new FirestoreV4GlobalWalletReadService(reader).readCurrentWallet()
        if (!cancelled) {
          setWallet({
            summary: createGlobalWalletSummary(result.groups, result.financialView, activeGroupId),
            entities: result.entities,
            financialView: result.financialView,
          })
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? `No se ha podido leer el resumen global: ${reason.message}` : 'No se ha podido leer el resumen global.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [firestore, refreshIndex])

  if (isLoading) return <section className="operational-history"><p>Cargando el estado actual del monedero…</p></section>
  if (error) return <section className="operational-history"><p className="form-error" role="alert">{error}</p><button type="button" onClick={() => setRefreshIndex((index) => index + 1)}>Reintentar lectura</button></section>

  const summary = wallet?.summary ?? null
  return (
    <section className={`operational-history global-wallet-summary global-wallet-summary--${presentation}`} aria-labelledby="global-wallet-title">
      <div className="section-heading"><div><p className="eyebrow">{isInformation ? 'Visión global' : 'Informes'}</p><h2 id="global-wallet-title">{isInformation ? '💰 Mi Monedero' : 'Resumen global'}</h2><p className="history-group-name">{isInformation ? 'Dinero disponible en todos los grupos' : 'Estado actual del monedero'}</p></div></div>
      {summary === null || summary.groups.length === 0 ? <p className="history-empty-state">No hay grupos V4 disponibles.</p> : <>
        <ul className="history-list">
          {summary.groups.map((group) => {
            if (!isInformation) return <li key={group.groupId} className={`wallet-group-row wallet-group-row--${balanceTone(group.balanceInCents)}`}><div><span><strong>{group.groupName}</strong>{group.groupId === activeGroupId && <small>Grupo activo</small>}</span></div><strong className={balanceTone(group.balanceInCents)}>{formatPdfMoney(group.balanceInCents)}</strong></li>

            const groupEntities = wallet?.entities.find((entities) => entities.group.id === group.groupId)
            const groupFinancialView = wallet?.financialView.groups.find((view) => view.groupId === group.groupId)
            const detail = groupEntities === undefined || groupFinancialView === undefined
              ? null
              : createWalletGroupDetail(group, groupEntities, groupFinancialView, selectedPersonId)
            const isExpanded = expandedGroupId === group.groupId

            return <li key={group.groupId} className={`wallet-group-row wallet-group-row--${balanceTone(group.balanceInCents)} ${isExpanded ? 'wallet-group-row--expanded' : ''}`}>
              <button className="wallet-group-toggle" type="button" aria-expanded={isExpanded} onClick={() => setExpandedGroupId((current) => toggleWalletGroupDetail(current, group.groupId))}>
                <span className="wallet-group-toggle-main"><span className="wallet-group-icon" aria-hidden="true">{groupInitial(group.groupName)}</span><span><strong>{group.groupName}</strong>{group.groupId === activeGroupId && <small>Grupo activo</small>}</span></span>
                <span className="wallet-group-toggle-value"><strong className={balanceTone(group.balanceInCents)}>{formatPdfMoney(group.balanceInCents)}</strong><span className="wallet-group-chevron" aria-hidden="true">⌄</span></span>
              </button>
              {isExpanded && detail !== null && <WalletGroupDetail detail={detail} />}
            </li>
          })}
        </ul>
        <div className={`expense-report-total global-wallet-total wallet-total--${balanceTone(summary.totalWalletInCents)}`}><strong>{isInformation ? 'TOTAL DISPONIBLE' : 'TOTAL MONEDERO'}</strong><strong className={balanceTone(summary.totalWalletInCents)}>{formatPdfMoney(summary.totalWalletInCents)}</strong></div>
        {!summary.isConsistent && <p className="form-error" role="alert">La suma de los saldos de grupo no coincide con el total del monedero.</p>}
      </>}
    </section>
  )
}