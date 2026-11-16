import { describe, expect, it } from 'vitest'
import type { Contribution, Person } from '../../domain/entities'
import { createMonthlyContributionsReport, earliestDatedContributionMonth } from './monthly-contributions'

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: false },
  { id: 'other', groupId: 'other', name: 'Otra', phone: '', isActive: true },
]
const contributions: readonly Contribution[] = [
  { id: 'opening-ana', groupId: 'general', personId: 'ana', date: null, amountInCents: 3000, source: 'v3-opening' },
  { id: 'opening-pepe', groupId: 'general', personId: 'pepe', date: null, amountInCents: 2000, source: 'v3-opening' },
  { id: 'jan-ana-1', groupId: 'general', personId: 'ana', date: '2025-01-05', amountInCents: 1000 },
  { id: 'jan-ana-2', groupId: 'general', personId: 'ana', date: '2025-01-20', amountInCents: 500 },
  { id: 'jan-pepe', groupId: 'general', personId: 'pepe', date: '2025-01-22', amountInCents: 2500 },
  { id: 'mar-correction', groupId: 'general', personId: 'ana', date: '2025-03-01', amountInCents: -200 },
  { id: 'other', groupId: 'other', personId: 'other', date: '2025-02-01', amountInCents: 99999 },
]

describe('resumen mensual de aportaciones', () => {
  it('agrupa por mes y persona, suma varias aportaciones y conserva personas inactivas', () => {
    const report = createMonthlyContributionsReport('general', people, contributions, { fromMonth: '2025-01', toMonth: '2025-03' })
    expect(report.months).toHaveLength(3)
    expect(report.months[0]).toMatchObject({ month: '2025-01', totalInCents: 4000, contributionCount: 3 })
    expect(report.months[0].people).toEqual([
      expect.objectContaining({ personId: 'ana', contributedInCents: 1500 }),
      expect.objectContaining({ personId: 'pepe', isActive: false, contributedInCents: 2500 }),
    ])
    expect(report.months[1]).toMatchObject({ month: '2025-02', people: [], totalInCents: 0, contributionCount: 0 })
    expect(report.months[2]).toMatchObject({ month: '2025-03', totalInCents: -200, contributionCount: 1 })
    expect(report.totalInRangeInCents).toBe(3800)
  })

  it('mantiene las aperturas heredadas separadas y fuera de los totales mensuales', () => {
    const report = createMonthlyContributionsReport('general', people, contributions, { fromMonth: '2025-01', toMonth: '2025-01' })
    expect(report.inheritedOpeningTotalInCents).toBe(5000)
    expect(report.inheritedOpeningByPerson).toEqual([
      expect.objectContaining({ personId: 'ana', contributedInCents: 3000 }),
      expect.objectContaining({ personId: 'pepe', contributedInCents: 2000, isActive: false }),
    ])
    expect(report.totalInRangeInCents).toBe(4000)
  })

  it('genera meses vacíos y atraviesa cambios de año', () => {
    const report = createMonthlyContributionsReport('general', people, [], { fromMonth: '2024-11', toMonth: '2025-02' })
    expect(report.months.map((month) => month.month)).toEqual(['2024-11', '2024-12', '2025-01', '2025-02'])
    expect(report.months.every((month) => month.totalInCents === 0)).toBe(true)
  })

  it('aísla el grupo y valida el rango', () => {
    expect(createMonthlyContributionsReport('other', people, contributions, { fromMonth: '2025-02', toMonth: '2025-02' }).totalInRangeInCents).toBe(99999)
    expect(() => createMonthlyContributionsReport('general', people, contributions, { fromMonth: '2025-03', toMonth: '2025-01' })).toThrow('Desde mes')
    expect(() => createMonthlyContributionsReport('general', people, contributions, { fromMonth: '2025-13', toMonth: '2025-13' })).toThrow('no es válido')
  })

  it('localiza el primer mes fechado sin convertir aperturas en meses', () => {
    expect(earliestDatedContributionMonth('general', contributions, '2026-11')).toBe('2025-01')
    expect(earliestDatedContributionMonth('missing', contributions, '2026-11')).toBe('2026-11')
  })
})
