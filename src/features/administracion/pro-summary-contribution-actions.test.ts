import { describe, expect, it } from 'vitest'
import type { Contribution } from '../../domain/entities'
import {
  ProSummaryContributionActionError,
  getManageableProSummaryContribution,
} from './pro-summary-contribution-actions'

const dated: Contribution = {
  id: 'dated', groupId: 'general', personId: 'pepe', date: '2026-08-10', amountInCents: 2000, source: 'user',
}
const opening: Contribution = {
  id: 'opening', groupId: 'general', personId: 'pepe', date: null, amountInCents: 5000, source: 'v3-opening',
}
const otherGroup: Contribution = {
  id: 'other', groupId: 'otro', personId: 'pepe', date: '2026-08-10', amountInCents: 1000, source: 'user',
}

describe('acciones de aportaciones del Resumen PRO', () => {
  it('permite gestionar una aportación fechada sin alterar su identidad', () => {
    expect(getManageableProSummaryContribution([dated], 'general', 'dated')).toBe(dated)
  })

  it('protege las aperturas heredadas de Inicio', () => {
    expect(() => getManageableProSummaryContribution([opening], 'general', 'opening')).toThrow(ProSummaryContributionActionError)
  })

  it('aísla estrictamente la aportación del grupo activo', () => {
    expect(() => getManageableProSummaryContribution([dated, otherGroup], 'general', 'other')).toThrow(ProSummaryContributionActionError)
  })
})
