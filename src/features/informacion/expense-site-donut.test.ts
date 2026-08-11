import { describe, expect, it } from 'vitest'
import { colorForExpenseSite, createExpenseSiteDonutSlices } from './expense-site-donut'

describe('donut de gasto por sitio', () => {
  it('asigna un color estable a cada sitio, incluso si cambia el orden de los segmentos', () => {
    expect(colorForExpenseSite('Flap')).toBe(colorForExpenseSite(' flap '))
    const [first] = createExpenseSiteDonutSlices([{ siteName: 'Flap', totalInCents: 100, percentageOfGroupTotal: 100 }], 100)
    const [, second] = createExpenseSiteDonutSlices([{ siteName: 'Lydo', totalInCents: 50, percentageOfGroupTotal: 50 }, { siteName: 'Flap', totalInCents: 50, percentageOfGroupTotal: 50 }], 100)
    expect(first.color).toBe(second.color)
  })

  it('usa solo los porcentajes ya preparados para calcular las posiciones visuales', () => {
    const slices = createExpenseSiteDonutSlices([
      { siteName: 'Flap', totalInCents: 750, percentageOfGroupTotal: 75 },
      { siteName: 'Lydo', totalInCents: 250, percentageOfGroupTotal: 25 },
    ], 100)

    expect(slices.map((slice) => slice.dashOffset)).toEqual([0, -75])
    expect(slices.map((slice) => slice.totalInCents)).toEqual([750, 250])
  })
})
