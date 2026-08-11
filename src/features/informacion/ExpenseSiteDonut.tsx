import { useState } from 'react'
import type { ExpenseBySiteSegment } from './expenses-by-site'
import { createExpenseSiteDonutSlices } from './expense-site-donut'

interface ExpenseSiteDonutProps {
  segments: readonly ExpenseBySiteSegment[]
  formatCurrency(amountInCents: number): string
  formatPercentage(percentage: number): string
}

const RADIUS = 44
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ExpenseSiteDonut({ segments, formatCurrency, formatPercentage }: ExpenseSiteDonutProps) {
  const slices = createExpenseSiteDonutSlices(segments, CIRCUMFERENCE)
  const [activeSiteName, setActiveSiteName] = useState(segments[0]?.siteName ?? '')
  const activeSlice = slices.find((slice) => slice.siteName === activeSiteName) ?? slices[0]

  return (
    <div className="expense-site-visualization">
      <div className="expense-site-donut-wrap">
        <svg className="expense-site-donut" viewBox="0 0 120 120" role="img" aria-label="Distribución del gasto por sitio">
          <circle className="expense-site-donut-track" cx="60" cy="60" r={RADIUS} />
          {slices.map((slice) => {
            const isActive = slice.siteName === activeSlice?.siteName
            const dashLength = Math.max(0, (slice.percentageOfGroupTotal / 100) * CIRCUMFERENCE - 1.2)
            return <circle
              key={slice.siteName}
              className={`expense-site-donut-slice${isActive ? ' is-active' : ''}`}
              cx="60"
              cy="60"
              r={RADIUS}
              stroke={slice.color}
              strokeDasharray={`${dashLength} ${CIRCUMFERENCE - dashLength}`}
              strokeDashoffset={slice.dashOffset}
              tabIndex={0}
              role="button"
              aria-label={`${slice.siteName}: ${formatCurrency(slice.totalInCents)}, ${formatPercentage(slice.percentageOfGroupTotal)} por ciento`}
              onMouseEnter={() => setActiveSiteName(slice.siteName)}
              onFocus={() => setActiveSiteName(slice.siteName)}
              onClick={() => setActiveSiteName(slice.siteName)}
            />
          })}
        </svg>
        {activeSlice && <div className="expense-site-donut-center" aria-live="polite"><strong>{activeSlice.siteName}</strong><span>{formatCurrency(activeSlice.totalInCents)}</span><small>{formatPercentage(activeSlice.percentageOfGroupTotal)} % del total</small></div>}
      </div>
      <ul className="site-expense-legend" aria-label="Leyenda de gasto por sitio">
        {slices.map((slice) => <li key={slice.siteName}><button type="button" className={slice.siteName === activeSlice?.siteName ? 'is-active' : ''} onMouseEnter={() => setActiveSiteName(slice.siteName)} onFocus={() => setActiveSiteName(slice.siteName)} onClick={() => setActiveSiteName(slice.siteName)}><span className="site-expense-color" style={{ backgroundColor: slice.color }} aria-hidden="true" /><span><strong>{slice.siteName}</strong><small>{formatPercentage(slice.percentageOfGroupTotal)} %</small></span><strong>{formatCurrency(slice.totalInCents)}</strong></button></li>)}
      </ul>
    </div>
  )
}
