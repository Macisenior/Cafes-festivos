/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  fileURLToPath(new URL('./InformationStateAtDate.tsx', import.meta.url)),
  'utf8',
)

describe('Estado a una fecha en Información', () => {
  it('reutiliza el informe V4 preparado y permanece como consulta plegable', () => {
    expect(source).toContain('createAccountStateAtDateReport')
    expect(source).toContain('<AccountStateAtDateResults report={report} />')
    expect(source).toContain('setIsOpen')
    expect(source).not.toContain('Exportar PDF')
    expect(source).not.toContain('setDoc')
    expect(source).not.toContain('updateDoc')
    expect(source).not.toContain('deleteDoc')
  })

  it('reinicia la consulta al grupo activo y usa exclusivamente sus entidades', () => {
    expect(source).toContain('[entities.group.id]')
    expect(source).toContain('entities.group')
    expect(source).toContain('entities.people')
    expect(source).toContain('entities.contributions')
    expect(source).toContain('entities.expenses')
  })
})
