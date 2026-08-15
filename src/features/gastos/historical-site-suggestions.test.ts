import { describe, expect, it } from 'vitest'
import type { Expense } from '../../domain/entities'
import { createHistoricalSiteSuggestions } from './historical-site-suggestions'

function expense(id: string, groupId: string, siteName: string): Expense {
  return {
    id,
    groupId,
    date: '2026-08-15',
    siteName,
    concept: 'Prueba',
    totalInCents: 100,
    participantIds: ['ana'],
    distribution: { mode: 'igual' },
    allocations: [{ personId: 'ana', amountInCents: 100 }],
  }
}

describe('sugerencias históricas de sitio', () => {
  const fixedSites = ['Flap', 'Colono', 'Lydo']

  it('ofrece solo sitios históricos del grupo activo y excluye los accesos rápidos', () => {
    expect(createHistoricalSiteSuggestions('general', [
      expense('one', 'general', 'Flap'),
      expense('two', 'general', 'Casa Mariano'),
      expense('three', 'general', 'Albergue'),
      expense('four', 'otro', 'Cantina ajena'),
    ], fixedSites)).toEqual(['Albergue', 'Casa Mariano'])
  })

  it('normaliza espacios y evita duplicados triviales sin restringir nombres nuevos', () => {
    expect(createHistoricalSiteSuggestions('general', [
      expense('one', 'general', '  Cantina Manolo  '),
      expense('two', 'general', 'cantina manolo'),
      expense('three', 'general', '  '),
      expense('four', 'general', 'LYDO'),
    ], fixedSites)).toEqual(['Cantina Manolo'])
  })
})