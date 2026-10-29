import { useMemo, useState, type FormEvent } from 'react'
import type { Group, Person } from '../../domain/entities'
import {
  FIXED_QUICK_NOTE_CONSUMPTIONS,
  QuickNoteError,
  addCustomQuickNoteConsumption,
  allQuickNoteConsumptions,
  changeQuickNoteQuantity,
  createEmptyQuickNote,
  createQuickNoteSummary,
  hasQuickNoteEntries,
  quickNoteQuantity,
} from './quick-note'
import { clearQuickNote, restoreQuickNote, saveQuickNote } from './quick-note-storage'

interface QuickNotePadProps {
  group: Group
  people: readonly Person[]
}

function newCustomConsumptionId(): string {
  return `custom-${crypto.randomUUID()}`
}

export function QuickNotePad({ group, people }: QuickNotePadProps) {
  const activePeople = useMemo(
    () => people.filter((person) => person.groupId === group.id && person.isActive),
    [group.id, people],
  )
  const [note, setNote] = useState(() => restoreQuickNote(window.localStorage, group.id))
  const [selectedConsumptionId, setSelectedConsumptionId] = useState<string>(FIXED_QUICK_NOTE_CONSUMPTIONS[0].id)
  const [isAddingOther, setIsAddingOther] = useState(false)
  const [customName, setCustomName] = useState('')
  const [storageError, setStorageError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  function updateNote(nextNote: typeof note) {
    try {
      if (hasQuickNoteEntries(nextNote)) saveQuickNote(window.localStorage, nextNote)
      else clearQuickNote(window.localStorage, nextNote.groupId)
      setStorageError(null)
    } catch {
      setStorageError('Los apuntes siguen visibles, pero no se han podido guardar en este dispositivo.')
    }
    setNote(nextNote)
  }

  const consumptions = allQuickNoteConsumptions(note)
  const selectedConsumption = consumptions.find((item) => item.id === selectedConsumptionId)
    ?? FIXED_QUICK_NOTE_CONSUMPTIONS[0]
  const summary = createQuickNoteSummary(note)

  function addOther(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    try {
      const id = newCustomConsumptionId()
      updateNote(addCustomQuickNoteConsumption(note, customName, id))
      setSelectedConsumptionId(id)
      setCustomName('')
      setIsAddingOther(false)
    } catch (reason) {
      setFormError(reason instanceof QuickNoteError ? reason.message : 'No se ha podido crear la consumición.')
    }
  }

  function changeQuantity(person: Person, delta: 1 | -1) {
    setFormError(null)
    try {
      updateNote(changeQuickNoteQuantity(note, person, selectedConsumption.id, delta))
    } catch (reason) {
      setFormError(reason instanceof QuickNoteError ? reason.message : 'No se ha podido cambiar la cantidad.')
    }
  }

  function clearAll() {
    if (!window.confirm(`¿Borrar todos los apuntes de ${group.name}? Esta acción no afecta a los gastos registrados.`)) return
    try {
      clearQuickNote(window.localStorage, group.id)
      setStorageError(null)
    } catch {
      setStorageError('No se han podido borrar los apuntes guardados en este dispositivo.')
      return
    }
    setNote(createEmptyQuickNote(group.id))
    setSelectedConsumptionId(FIXED_QUICK_NOTE_CONSUMPTIONS[0].id)
    setCustomName('')
    setIsAddingOther(false)
    setFormError(null)
  }

  return (
    <div className="quick-note-pad">
      <p className="quick-note-intro">Libreta temporal de {group.name}. No registra gastos ni modifica saldos.</p>

      <div className="quick-note-consumptions" aria-label="Seleccionar consumición">
        {consumptions.map((consumption) => (
          <button
            key={consumption.id}
            type="button"
            className={selectedConsumption.id === consumption.id ? 'is-selected' : ''}
            aria-pressed={selectedConsumption.id === consumption.id}
            onClick={() => { setSelectedConsumptionId(consumption.id); setIsAddingOther(false); setFormError(null) }}
          >
            {consumption.name}
          </button>
        ))}
        <button
          type="button"
          className={isAddingOther ? 'is-selected' : ''}
          aria-expanded={isAddingOther}
          onClick={() => { setIsAddingOther((open) => !open); setFormError(null) }}
        >
          + Otro
        </button>
      </div>

      {isAddingOther && (
        <form className="quick-note-other-form" onSubmit={addOther}>
          <label htmlFor={`quick-note-other-${group.id}`}>Nueva consumición</label>
          <div>
            <input id={`quick-note-other-${group.id}`} value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Agua, Refresco…" maxLength={40} autoFocus />
            <button type="submit">Añadir</button>
          </div>
        </form>
      )}

      <section className="quick-note-counter-section" aria-labelledby={`quick-note-counter-${group.id}`}>
        <div className="quick-note-section-heading">
          <span>Apuntando</span>
          <strong id={`quick-note-counter-${group.id}`}>{selectedConsumption.name}</strong>
        </div>
        {activePeople.length === 0 ? (
          <p className="quick-note-empty">No hay personas activas en este grupo.</p>
        ) : (
          <ul className="quick-note-person-list">
            {activePeople.map((person) => {
              const quantity = quickNoteQuantity(note, person.id, selectedConsumption.id)
              return (
                <li key={person.id}>
                  <span>{person.name}</span>
                  <div className="quick-note-counter" aria-label={`${selectedConsumption.name} de ${person.name}`}>
                    <button type="button" onClick={() => changeQuantity(person, -1)} disabled={quantity === 0} aria-label={`Restar ${selectedConsumption.name} a ${person.name}`}>−</button>
                    <strong aria-live="polite">{quantity}</strong>
                    <button type="button" onClick={() => changeQuantity(person, 1)} aria-label={`Sumar ${selectedConsumption.name} a ${person.name}`}>+</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="quick-note-summary" aria-labelledby={`quick-note-summary-${group.id}`}>
        <div className="quick-note-section-heading">
          <span>Resumen</span>
          <strong id={`quick-note-summary-${group.id}`}>{summary.length} {summary.length === 1 ? 'persona' : 'personas'}</strong>
        </div>
        {summary.length === 0 ? <p className="quick-note-empty">Todavía no hay consumiciones anotadas.</p> : (
          <ul>
            {summary.map((person) => (
              <li key={person.personId}>
                <strong>{person.personName}</strong>
                <span>{person.items.map((item) => `${item.consumptionName} × ${item.quantity}`).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {formError && <p className="form-error" role="alert">{formError}</p>}
      {storageError && <p className="form-error" role="alert">{storageError}</p>}
      <button type="button" className="quick-note-clear" onClick={clearAll} disabled={!hasQuickNoteEntries(note)}>Borrar apuntes del grupo</button>
    </div>
  )
}
