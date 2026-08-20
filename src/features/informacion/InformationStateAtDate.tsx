import { useEffect, useState } from 'react'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import { AccountStateAtDateResults } from '../administracion/AccountStateAtDateResults'
import { createAccountStateAtDateReport } from '../administracion/account-state-at-date'

interface InformationStateAtDateProps {
  entities: GroupFinancialEntities
}

function todayInMadrid(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** Consulta plegable que reutiliza el informe administrativo sin PDF ni escrituras. */
export function InformationStateAtDate({ entities }: InformationStateAtDateProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [date, setDate] = useState(todayInMadrid)
  const report = createAccountStateAtDateReport(
    entities.group,
    entities.people,
    entities.contributions,
    entities.expenses,
    date,
  )

  useEffect(() => {
    setIsOpen(false)
    setDate(todayInMadrid())
  }, [entities.group.id])

  return <section className={`information-state-at-date${isOpen ? ' is-open' : ''}`} aria-labelledby="information-state-at-date-title">
    <div className="information-state-at-date-heading">
      <div><p className="eyebrow">Consulta rápida</p><h2 id="information-state-at-date-title">📅 Estado a una fecha</h2><p>Consulta cómo estaban las cuentas al cierre de un día.</p></div>
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>{isOpen ? 'Cerrar' : 'Consultar'}</button>
    </div>
    {isOpen && <div className="information-state-at-date-content">
      <label>Fecha<input type="date" value={date} onChange={(event) => { if (event.target.value !== '') setDate(event.target.value) }} required /></label>
      <p className="information-state-at-date-group">Grupo: {entities.group.name}</p>
      <AccountStateAtDateResults report={report} />
    </div>}
  </section>
}
