/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  fileURLToPath(new URL('./AccountStatusList.tsx', import.meta.url)),
  'utf8',
)

describe('destacado del usuario actual en Estado de cuentas', () => {
  it('marca únicamente la tarjeta cuyo id coincide con la persona seleccionada', () => {
    expect(source).toContain('selectedPersonId === person.id')
    expect(source).toContain("' is-current-user'")
    expect(source).not.toContain('information-current-user-badge')
    expect(source).not.toContain('>Tú</small>')
  })

  it('mantiene los estados financieros y el comportamiento desplegable existentes', () => {
    expect(source).toContain('account-card--${accountStatus.tone}')
    expect(source).toContain('aria-expanded={isExpanded}')
    expect(source).toContain('createPersonAccountSummary(')
    expect(source).toContain('setExpandedPersonId')
  })
})
