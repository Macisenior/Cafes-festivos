/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const disclosureSource = readFileSync(fileURLToPath(new URL('./QuickNoteDisclosure.tsx', import.meta.url)), 'utf8')
const padSource = readFileSync(fileURLToPath(new URL('./QuickNotePad.tsx', import.meta.url)), 'utf8')
const informationSource = readFileSync(fileURLToPath(new URL('../informacion/InformationPage.tsx', import.meta.url)), 'utf8')
const operationalSource = readFileSync(fileURLToPath(new URL('../operativa/OperationalPage.tsx', import.meta.url)), 'utf8')

describe('arquitectura de Apunte rápido', () => {
  it('permanece separado de Firestore, Functions y la contabilidad real', () => {
    expect(disclosureSource).not.toContain("from 'firebase")
    expect(padSource).not.toContain("from 'firebase")
    expect(padSource).not.toContain('createExpense')
    expect(padSource).not.toContain('onGroupChanged')
    expect(padSource).not.toContain('QuickExpenseForm')
  })

  it('aparece después de Gasto rápido en Información y Operativa', () => {
    expect(informationSource.indexOf('QuickExpenseDisclosure')).toBeLessThan(informationSource.lastIndexOf('QuickNoteDisclosure'))
    expect(operationalSource.indexOf('QuickExpenseDisclosure')).toBeLessThan(operationalSource.lastIndexOf('QuickNoteDisclosure'))
  })

  it('usa persistencia local y confirmación para el borrado', () => {
    expect(padSource).toContain('window.localStorage')
    expect(padSource).toContain('window.confirm')
    expect(padSource).toContain('clearQuickNote')
  })
})
