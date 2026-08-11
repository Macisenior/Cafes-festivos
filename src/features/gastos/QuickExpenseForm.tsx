import { useEffect, useState, type FormEvent } from 'react'
import type { Group, Person } from '../../domain/entities'
import { eurosToCents } from '../aportaciones/cash-contribution-request'
import { createQuickExpenseWhatsAppUrl, prepareQuickExpenseDraft } from './quick-expense'

const MAIN_SITES = ['Flap', 'Colono', 'Lydo'] as const
interface QuickExpenseFormProps { group: Group; people: readonly Person[]; embedded?: boolean }

export function QuickExpenseForm({ group, people, embedded = false }: QuickExpenseFormProps) {
  const activePeople = people.filter((person) => person.groupId === group.id && person.isActive)
  const [siteName, setSiteName] = useState('')
  const [selectedMainSite, setSelectedMainSite] = useState<string | null>(null)
  const [amountInEuros, setAmountInEuros] = useState('')
  const [reportedPayerPersonId, setReportedPayerPersonId] = useState('')
  const [participantIds, setParticipantIds] = useState<readonly string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setSiteName(''); setSelectedMainSite(null); setAmountInEuros(''); setReportedPayerPersonId(''); setParticipantIds([]); setMessage(null); setError(null) }, [group.id])
  function toggleParticipant(personId: string) { setParticipantIds((current) => current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]) }
  function selectAll() { setParticipantIds(activePeople.map((person) => person.id)) }
  function resetDraft() { setSiteName(''); setSelectedMainSite(null); setAmountInEuros(''); setReportedPayerPersonId(''); setParticipantIds([]) }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null); setError(null)
    try {
      const draft = prepareQuickExpenseDraft(group, people, { groupId: group.id, siteName, amountInCents: eurosToCents(amountInEuros), reportedPayerPersonId, participantIds })
      const whatsAppUrl = createQuickExpenseWhatsAppUrl(draft)
      if (whatsAppUrl === null) throw new Error('No hay un teléfono de administrador configurado para Gasto rápido.')
      const popup = window.open(whatsAppUrl, '_blank', 'noopener,noreferrer')
      if (popup === null) throw new Error('El navegador ha bloqueado la apertura de WhatsApp.')
      resetDraft(); setMessage('Borrador preparado para WhatsApp. No se ha registrado ningún gasto.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se ha podido preparar el borrador.') }
  }

  return <section className={`expense-section quick-expense-form ${embedded ? 'quick-expense-form--embedded' : ''}`} aria-labelledby={embedded ? undefined : 'quick-expense-title'}>
    {!embedded && <div className="section-heading"><div><p className="eyebrow">Comunicación</p><h2 id="quick-expense-title">Gasto rápido</h2><p className="expense-deletion-note">Prepara un aviso para WhatsApp; no registra un gasto ni modifica saldos.</p></div></div>}
    {embedded && <p className="quick-expense-embedded-note">Prepara un aviso por WhatsApp. No registra ningún gasto ni modifica saldos.</p>}
    <form className="expense-form" onSubmit={submit}>
      <fieldset className="expense-site-picker"><legend>Sitio</legend><div className="expense-site-chips">{MAIN_SITES.map((site) => <button key={site} type="button" className={`expense-site-chip expense-site-chip--${site.toLowerCase()} ${selectedMainSite === site ? 'is-selected' : ''}`} onClick={() => { setSiteName(site); setSelectedMainSite(site) }}>{site}</button>)}</div><label>Otro sitio…<input value={siteName} onChange={(event) => { setSiteName(event.target.value); setSelectedMainSite(null) }} placeholder="Escribe otro sitio" required /></label></fieldset>
      <label className="quick-expense-amount">Importe (€)<input value={amountInEuros} onChange={(event) => setAmountInEuros(event.target.value)} inputMode="decimal" placeholder="0,00" required /></label>
      <label className="quick-expense-payer">Pagado por<select value={reportedPayerPersonId} onChange={(event) => setReportedPayerPersonId(event.target.value)}><option value="">No indicado</option>{activePeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <fieldset className="expense-participants-picker"><legend>Participantes ({participantIds.length} de {activePeople.length})</legend><button className="expense-select-all" type="button" onClick={selectAll}>Seleccionar todos</button><div className="expense-participant-grid">{activePeople.map((person) => { const isSelected = participantIds.includes(person.id); return <label key={person.id} className={`expense-participant-chip ${isSelected ? 'is-selected' : ''}`}><input type="checkbox" checked={isSelected} onChange={() => toggleParticipant(person.id)} /><span>{person.name}</span><b aria-hidden="true">✓</b></label> })}</div></fieldset>
      <button type="submit">📲 Enviar por WhatsApp</button>
    </form>
    {message && <p className="operation-message">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </section>
}