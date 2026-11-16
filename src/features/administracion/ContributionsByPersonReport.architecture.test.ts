/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ContributionsByPersonReport.tsx', import.meta.url)), 'utf8')

describe('pestañas del informe de aportaciones', () => {
  it('mantiene Histórico acumulado como vista inicial y conserva su cálculo y PDF', () => {
    expect(source).toContain("useState<'historical' | 'monthly'>('historical')")
    expect(source).toContain('createContributionsByPersonReport')
    expect(source).toContain('prepareContributionsByPersonPdf')
    expect(source).toContain('Histórico acumulado')
  })

  it('incorpora Resumen mensual sin acceso a Firestore', () => {
    expect(source).toContain('MonthlyContributionsView')
    expect(source).toContain('Resumen mensual')
    expect(source).not.toContain('firebase')
    expect(source).not.toContain('firestore')
  })

  it('ofrece descarga y compartición para ambos PDF mensuales', () => {
    const monthlySource = readFileSync(fileURLToPath(new URL('./MonthlyContributionsView.tsx', import.meta.url)), 'utf8')
    expect(monthlySource).toContain("exportPdf('summary')")
    expect(monthlySource).toContain("sharePdf('summary')")
    expect(monthlySource).toContain("exportPdf('detailed')")
    expect(monthlySource).toContain("sharePdf('detailed')")
    expect(monthlySource).toContain('adjunta el PDF manualmente en WhatsApp')
  })
})
