import { createPdfDocumentFromPages, formatPdfMoney } from './historical-pdf'
import type { MonthlyContributionPerson, MonthlyContributionsReport } from './monthly-contributions'

export type MonthlyContributionsPdfMode = 'summary' | 'detailed'

interface MonthlyContributionsPdf {
  groupName: string
  report: MonthlyContributionsReport
  generatedOn: string
  mode: MonthlyContributionsPdfMode
}

const WIDTH = 306
const HEIGHT = 544
const LEFT = 16
const RIGHT = WIDTH - LEFT
const BOTTOM = 36
const LINE_HEIGHT = 14
const ROW_PADDING = 10
const BLOCK_GAP = 5
const INK = '0.09 0.17 0.14'
const MUTED = '0.30 0.37 0.34'
const GREEN = '0.06 0.27 0.22'
const RED = '0.63 0.17 0.15'
const PALE_GREEN = '0.90 0.95 0.93'
const WHITE = '1 1 1'

type Font = 'F1' | 'F2'
interface Page { commands: string[]; y: number }
interface Row {
  label: string
  note?: string
  amount?: number
  style: 'section' | 'person' | 'total'
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const value = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Helvetica and Helvetica-Bold glyph widths, in thousandths of an em.
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const regularWidths = [
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
]
const boldWidths = [
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500,
]

function textWidth(value: string, font: Font, size: number): number {
  const widths = font === 'F2' ? boldWidths : regularWidths
  let units = 0
  for (const character of value) {
    const index = letters.indexOf(character.normalize('NFD')[0])
    if (index >= 0) units += widths[index]
    else if (/[0-9€]/.test(character)) units += 556
    else if (' .,:'.includes(character)) units += 278
    else if ('-/()'.includes(character)) units += 333
    else units += 1015
  }
  return units * size / 1000
}

function wrap(value: string, font: Font, size: number, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of value.trim().split(/\s+/)) {
    const next = line === '' ? word : `${line} ${word}`
    if (textWidth(next, font, size) <= width) {
      line = next
      continue
    }
    if (line !== '') lines.push(line)
    line = ''
    for (const character of word) {
      if (textWidth(line + character, font, size) > width) {
        lines.push(line)
        line = ''
      }
      line += character
    }
  }
  return [...lines, line]
}

function text(font: Font, size: number, x: number, y: number, value: string, color = INK): string {
  const escaped = value.replace(/([\\()])/g, '\\$1')
  return `${color} rg\nBT\n/${font} ${size} Tf\n1 0 0 1 ${x} ${y} Tm\n(${escaped}) Tj\nET`
}

function personRow(person: MonthlyContributionPerson): Row {
  return {
    label: person.personName,
    note: person.isActive ? undefined : 'Persona inactiva',
    amount: person.contributedInCents,
    style: 'person',
  }
}

function layoutRow(row: Row) {
  const isPerson = row.style === 'person'
  const isTotal = row.style === 'total'
  const left = LEFT + (isPerson ? 16 : 8)
  const right = RIGHT - 8
  const size = isTotal ? 13 : 11
  const font: Font = isPerson ? 'F1' : 'F2'
  const amount = row.amount === undefined ? '' : formatPdfMoney(row.amount)
  const amountX = right - textWidth(amount, 'F2', size)
  const labelWidth = amount === '' ? right - left : amountX - left - 10
  const lines = wrap(row.label, font, size, labelWidth).map((value) => ({ value, font, size, color: isTotal ? WHITE : INK }))
  if (row.note !== undefined) {
    lines.push(...wrap(row.note, 'F1', 9, labelWidth).map((value) => ({ value, font: 'F1' as const, size: 9, color: MUTED })))
  }
  return { lines, left, size, amount, amountX, amountColor: isTotal ? WHITE : (row.amount ?? 0) < 0 ? RED : GREEN }
}

export function prepareMonthlyContributionsPdf(
  groupName: string, report: MonthlyContributionsReport, generatedOn: string, mode: MonthlyContributionsPdfMode,
): MonthlyContributionsPdf {
  return { groupName, report, generatedOn, mode }
}

export function createMonthlyContributionsPdfPages({ groupName, report, generatedOn, mode }: MonthlyContributionsPdf): readonly string[] {
  const title = mode === 'summary' ? 'Resumen por mes' : 'Detalle por mes y persona'
  const pages: Page[] = []

  function startPage(): Page {
    const first = pages.length === 0
    let page = { commands: [
      `${GREEN} rg\n${LEFT} 522 ${RIGHT - LEFT} 3 re f`,
      text('F2', first ? 18 : 13, LEFT, 496, 'Aportaciones mensuales', GREEN),
      text('F2', 10, LEFT, 478, title, GREEN),
    ], y: 462 }
    pages.push(page)
    if (first) {
      const labels = [
        `Grupo: ${groupName}`,
        `Desde ${monthLabel(report.range.fromMonth)} hasta ${monthLabel(report.range.toMonth)}`,
        `Generado: ${generatedOn}`,
      ]
      for (const label of labels) {
        for (const line of wrap(label, 'F1', 10, RIGHT - LEFT)) {
          if (page.y - LINE_HEIGHT < BOTTOM) {
            page = startPage()
          }
          page.commands.push(text('F1', 10, LEFT, page.y - 10, line, MUTED))
          page.y -= LINE_HEIGHT
        }
      }
      page.y -= 10
    }
    return page
  }

  let page = startPage()

  function drawRow(row: Row, continuation?: string): void {
    const layout = layoutRow(row)
    let offset = 0
    while (offset < layout.lines.length) {
      if (page.y - ROW_PADDING - LINE_HEIGHT < BOTTOM) {
        page = startPage()
        if (continuation !== undefined) drawRow({ label: continuation, style: 'section' })
      }
      const count = Math.min(layout.lines.length - offset, Math.floor((page.y - BOTTOM - ROW_PADDING) / LINE_HEIGHT))
      const height = ROW_PADDING + count * LINE_HEIGHT
      const bottom = page.y - height
      if (row.style !== 'person') {
        page.commands.push(`${row.style === 'total' ? GREEN : PALE_GREEN} rg\n${LEFT} ${bottom} ${RIGHT - LEFT} ${height} re f`)
      } else {
        page.commands.push(`0.86 0.90 0.88 RG\n0.5 w\n${layout.left} ${bottom} m\n${RIGHT} ${bottom} l\nS`)
      }
      if (offset === 0 && layout.amount !== '') {
        page.commands.push(text('F2', layout.size, layout.amountX, page.y - 16, layout.amount, layout.amountColor))
      }
      layout.lines.slice(offset, offset + count).forEach((line, index) => {
        page.commands.push(text(line.font, line.size, layout.left, page.y - 16 - index * LINE_HEIGHT, line.value, line.color))
      })
      page.y = bottom
      offset += count
    }
  }

  function rowHeight(row: Row): number {
    return ROW_PADDING + layoutRow(row).lines.length * LINE_HEIGHT
  }

  function block(header: Row, people: readonly MonthlyContributionPerson[], closingHeight = 0): void {
    const headerHeight = rowHeight(header)
    const firstPersonHeight = people.length > 0
      ? Math.min(rowHeight(personRow(people[0])), 100)
      : 0
    const requiredHeight = BLOCK_GAP + headerHeight + firstPersonHeight + (people.length <= 1 ? closingHeight : 0)
    if (page.y - requiredHeight < BOTTOM) page = startPage()
    page.y -= BLOCK_GAP
    drawRow(header)

    const continuation = `${header.label} (continúa)`
    people.forEach((person, index) => {
      const row = personRow(person)
      const room = Math.min(rowHeight(row), 100) + (index === people.length - 1 ? closingHeight : 0)
      if (page.y - room < BOTTOM) {
        page = startPage()
        drawRow({ label: continuation, style: 'section' })
      }
      drawRow(row, continuation)
    })
  }

  for (const month of report.months) {
    block({
      label: monthLabel(month.month),
      note: `${month.contributionCount} ${month.contributionCount === 1 ? 'movimiento' : 'movimientos'}`,
      amount: month.totalInCents,
      style: 'section',
    }, mode === 'detailed' ? month.people : [])
  }

  const openings: Row = {
    label: 'Aperturas sin fecha',
    note: 'Fuera del período',
    amount: report.inheritedOpeningTotalInCents,
    style: 'section',
  }
  const total: Row = { label: 'Total del período', amount: report.totalInRangeInCents, style: 'total' }
  const openingPeople = mode === 'detailed' ? report.inheritedOpeningByPerson : []
  block(openings, openingPeople, BLOCK_GAP + rowHeight(total))
  if (page.y - BLOCK_GAP - rowHeight(total) < BOTTOM) page = startPage()
  page.y -= BLOCK_GAP
  drawRow(total)

  return pages.map((item, index) => [
    ...item.commands,
    `0.86 0.90 0.88 RG\n0.5 w\n${LEFT} 26 m\n${RIGHT} 26 l\nS`,
    text('F1', 8, LEFT, 14, 'Gastos del Grupo V4', MUTED),
    text('F1', 8, RIGHT - textWidth(`Página ${index + 1} de ${pages.length}`, 'F1', 8), 14, `Página ${index + 1} de ${pages.length}`, MUTED),
  ].join('\n'))
}

export function createMonthlyContributionsPdfDocument(pdf: MonthlyContributionsPdf): Blob {
  return createPdfDocumentFromPages(createMonthlyContributionsPdfPages(pdf), WIDTH, HEIGHT)
}
