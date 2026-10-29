import { useState } from 'react'
import type { Group, Person } from '../../domain/entities'
import { QuickNotePad } from './QuickNotePad'

interface QuickNoteDisclosureProps {
  group: Group
  people: readonly Person[]
}

/** Libreta local y temporal, aislada de Firestore y de la contabilidad real. */
export function QuickNoteDisclosure({ group, people }: QuickNoteDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="quick-note-disclosure" aria-labelledby="quick-note-disclosure-title">
      <button type="button" className="quick-note-disclosure-toggle" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        <span className="quick-note-disclosure-icon" aria-hidden="true">📝</span>
        <span><strong id="quick-note-disclosure-title">Apunte rápido</strong><small>Anotar consumiciones temporalmente</small></span>
        <span className="quick-note-disclosure-action">{isOpen ? 'Cerrar' : 'Abrir'}</span>
      </button>
      {isOpen && <div className="quick-note-disclosure-content"><QuickNotePad key={group.id} group={group} people={people} /></div>}
    </section>
  )
}
