import { describe, expect, it } from 'vitest'
import type { Contribution } from '../../domain/entities'
import { resetCashFormAfterSave, summarizeSameDayContributions } from './cash-contribution-confirmation'

const contributions: readonly Contribution[] = [
  {
    id: 'first',
    groupId: 'general',
    personId: 'pepe',
    amountInCents: 2000,
    date: '2026-08-09',
    source: 'user',
  },
  {
    id: 'second',
    groupId: 'general',
    personId: 'pepe',
    amountInCents: 1000,
    date: '2026-08-09',
    source: 'user',
  },
]

describe('confirmación de aportaciones del mismo día', () => {
  it('no solicita aviso cuando no hay aportaciones de esa persona y fecha', () => {
    expect(summarizeSameDayContributions(contributions, 'ana', '2026-08-09')).toEqual({
      count: 0,
      totalInCents: 0,
    })
  })

  it('detecta una aportación previa del mismo día', () => {
    expect(summarizeSameDayContributions(contributions.slice(0, 1), 'pepe', '2026-08-09')).toEqual({
      count: 1,
      totalInCents: 2000,
    })
  })

  it('resume número y total cuando hay varias aportaciones previas', () => {
    expect(summarizeSameDayContributions(contributions, 'pepe', '2026-08-09')).toEqual({
      count: 2,
      totalInCents: 3000,
    })
  })

  it('restablece el selector y el importe tras guardar, conservando la fecha', () => {
    expect(resetCashFormAfterSave('2026-08-09')).toEqual({
      personId: '',
      amountInEuros: '',
      date: '2026-08-09',
    })
  })
})
