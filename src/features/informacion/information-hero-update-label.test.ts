/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  fileURLToPath(new URL('./InformationPage.tsx', import.meta.url)),
  'utf8',
)

describe('etiqueta de actualización del Hero de Información', () => {
  it('muestra la fecha local dinámica en formato español y elimina Solo lectura', () => {
    expect(source).toContain("new Intl.DateTimeFormat('es-ES'")
    expect(source).toContain("day: '2-digit'")
    expect(source).toContain("month: '2-digit'")
    expect(source).toContain('Actualizado hoy · {todayLabel}')
    expect(source).not.toContain('Solo lectura')
  })
})
