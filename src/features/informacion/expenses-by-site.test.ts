import { describe, expect, it } from 'vitest'
import type { Expense } from '../../domain/entities'
import { createExpensesBySite } from './expenses-by-site'

function expense(id: string, groupId: string, siteName: string, totalInCents: number): Expense {
  return {
    id,
    groupId,
    date: '2026-08-09',
    concept: 'Prueba',
    siteName,
    totalInCents,
    participantIds: ['ana'],
    distribution: { mode: 'igual' },
    allocations: [{ personId: 'ana', amountInCents: totalInCents }],
  }
}

describe('gasto por sitio', () => {
  it('acumula varios gastos del mismo sitio y mantiene sitios distintos', () => {
    const summary = createExpensesBySite('general', [
      expense('one', 'general', 'Flap', 1250),
      expense('two', 'general', 'Flap', 750),
      expense('three', 'general', 'Lydo', 500),
    ])

    expect(summary).toEqual([
      { siteName: 'Flap', totalInCents: 2000, percentageOfGroupTotal: 80 },
      { siteName: 'Lydo', totalInCents: 500, percentageOfGroupTotal: 20 },
    ])
  })

  it('devuelve un estado vacío para un grupo sin gastos válidos', () => {
    expect(createExpensesBySite('general', [expense('other', 'otro', 'Flap', 100)])).toEqual([])
  })

  it('ordena los sitios de mayor a menor gasto', () => {
    const summary = createExpensesBySite('general', [
      expense('one', 'general', 'Sitio pequeño', 100),
      expense('two', 'general', 'Sitio grande', 300),
      expense('three', 'general', 'Sitio medio', 200),
    ])

    expect(summary.map((entry) => entry.siteName)).toEqual(['Sitio grande', 'Sitio medio', 'Sitio pequeño'])
  })

  it('aísla el cambio de grupo e ignora gastos inválidos', () => {
    const invalid = expense('invalid', 'general', '', 100)
    const summary = createExpensesBySite('viernes', [
      expense('general', 'general', 'Flap', 1000),
      expense('viernes', 'viernes', 'Colono', 600),
      invalid,
    ])

    expect(summary).toEqual([{ siteName: 'Colono', totalInCents: 600, percentageOfGroupTotal: 100 }])
  })

  it('conserva la igualdad entre la suma por sitio y el gasto total válido del grupo', () => {
    const expenses = [
      expense('one', 'general', 'Flap', 1999),
      expense('two', 'general', 'Lydo', 2001),
      expense('three', 'otro', 'Flap', 9999),
    ]

    const totalBySite = createExpensesBySite('general', expenses)
      .reduce((total, entry) => total + entry.totalInCents, 0)

    expect(totalBySite).toBe(4000)
  })
})
