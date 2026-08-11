import { useState } from 'react'
import type { Group, Person } from '../../domain/entities'
import { QuickExpenseForm } from '../gastos/QuickExpenseForm'

interface QuickExpenseDisclosureProps {
  group: Group
  people: readonly Person[]
}

/** Acceso compacto de consulta/comunicación; el formulario conserva su lógica propia. */
export function QuickExpenseDisclosure({ group, people }: QuickExpenseDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="quick-expense-disclosure" aria-labelledby="quick-expense-disclosure-title">
      <button type="button" className="quick-expense-disclosure-toggle" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        <span className="quick-expense-disclosure-icon" aria-hidden="true">⚡</span>
        <span><strong id="quick-expense-disclosure-title">Gasto rápido</strong><small>Preparar un aviso por WhatsApp</small></span>
        <span className="quick-expense-disclosure-action">{isOpen ? 'Cerrar' : 'Abrir'}</span>
      </button>
      {isOpen && <div className="quick-expense-disclosure-form"><QuickExpenseForm group={group} people={people} embedded /></div>}
    </section>
  )
}
