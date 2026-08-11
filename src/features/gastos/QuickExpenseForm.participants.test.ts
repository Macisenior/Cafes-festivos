/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./QuickExpenseForm.tsx', import.meta.url)), 'utf8')

describe('selector visual de participantes de Gasto rápido', () => {
  it('conserva checkboxes nativos y el mismo estado de selección en tarjetas táctiles', () => {
    expect(source).toContain('expense-participant-chip')
    expect(source).toContain('type="checkbox"')
    expect(source).toContain('checked={isSelected}')
    expect(source).toContain('toggleParticipant(person.id)')
    expect(source).toContain('Seleccionar todos')
  })

  it('no enlaza Pagado por con los participantes ni modifica el borrador de WhatsApp', () => {
    expect(source).toContain('setReportedPayerPersonId')
    expect(source).toContain('participantIds')
    expect(source).not.toContain('setParticipantIds([reportedPayerPersonId])')
    expect(source).toContain('prepareQuickExpenseDraft')
  })
})
