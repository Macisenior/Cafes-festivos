import { describe, expect, it } from 'vitest'
import type { Contribution, Person } from '../../domain/entities'
import { createContributionsByPersonReport } from './contributions-by-person'

const people: readonly Person[] = [
  { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: false },
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'otro', groupId: 'otro', name: 'Otro', phone: '', isActive: true },
]

const contributions: readonly Contribution[] = [
  { id: 'opening-pepe', groupId: 'general', personId: 'pepe', date: null, amountInCents: 30000, source: 'v3-opening' },
  { id: 'pepe-one', groupId: 'general', personId: 'pepe', date: '2026-08-01', amountInCents: 20000, source: 'user' },
  { id: 'pepe-negative', groupId: 'general', personId: 'pepe', date: '2026-08-08', amountInCents: -1700, source: 'user' },
  { id: 'ana-one', groupId: 'general', personId: 'ana', date: '2026-08-31', amountInCents: 10000, source: 'user' },
  { id: 'other', groupId: 'otro', personId: 'otro', date: '2026-08-01', amountInCents: 99999, source: 'user' },
]

describe('informe Aportaciones por persona', () => {
  it('suma los movimientos reales positivos y negativos por persona, manteniendo una inactiva', () => {
    const report = createContributionsByPersonReport('general', people, contributions)

    expect(report.people).toEqual([
      expect.objectContaining({ personId: 'pepe', isActive: false, contributedInCents: 48300 }),
      expect.objectContaining({ personId: 'ana', contributedInCents: 10000 }),
    ])
    expect(report.totalContributionsInCents).toBe(58300)
    expect(report.includedContributionCount).toBe(4)
  })

  it('aplica Desde, Hasta e inclusión de ambos extremos', () => {
    expect(createContributionsByPersonReport('general', people, contributions, { from: '2026-08-01', to: '2026-08-31' })).toMatchObject({ totalContributionsInCents: 28300, includedContributionCount: 3 })
    expect(createContributionsByPersonReport('general', people, contributions, { from: '2026-08-08', to: '' })).toMatchObject({ totalContributionsInCents: 8300, includedContributionCount: 2 })
    expect(createContributionsByPersonReport('general', people, contributions, { from: '', to: '2026-08-01' })).toMatchObject({ totalContributionsInCents: 20000, includedContributionCount: 1 })
  })

  it('incluye aportaciones heredadas sin fecha solo cuando no existe rango', () => {
    expect(createContributionsByPersonReport('general', people, contributions).people[0].contributedInCents).toBe(48300)
    expect(createContributionsByPersonReport('general', people, contributions, { from: '2026-08-01', to: '' }).people[0].contributedInCents).toBe(18300)
  })

  it('aísla el grupo activo y permite estado vacío', () => {
    expect(createContributionsByPersonReport('otro', people, contributions).totalContributionsInCents).toBe(99999)
    expect(createContributionsByPersonReport('vacío', people, contributions)).toMatchObject({ people: [], totalContributionsInCents: 0, includedContributionCount: 0 })
  })
})
