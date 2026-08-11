import type { Person } from '../../domain/entities'
import type { AmountInCents } from '../../domain/money'
import type { HistoricalFilters } from '../operativa/operational-history-filters'
import type { OperationalHistoryEntry } from '../operativa/operational-history'

export interface HistoricalPdfMovement {
  kind: 'contribution' | 'expense'
  date: string | null
  description: string
  amountInCents: AmountInCents
}

export interface HistoricalPdfReport {
  groupName: string
  generatedOn: string
  filters: readonly string[]
  movements: readonly HistoricalPdfMovement[]
  totalContributionsInCents: AmountInCents
  totalExpensesInCents: AmountInCents
  balanceInCents: AmountInCents
}

/** Formato español de presentación; los importes de entrada permanecen en céntimos. */
export function formatPdfMoney(amountInCents: AmountInCents): string {
  const sign = amountInCents < 0 ? '-' : ''
  const absoluteAmount = Math.abs(amountInCents)
  return `${sign}${Math.floor(absoluteAmount / 100)},${String(absoluteAmount % 100).padStart(2, '0')} €`
}

/** Formato de fecha de informe sin horas ni conversiones de zona horaria. */
export function formatPdfDate(date: string | null): string {
  if (date === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Sin fecha histórica'
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function filterLabels(filters: HistoricalFilters, people: readonly Person[]): readonly string[] {
  const labels: string[] = []
  if (filters.from !== '') labels.push(`Desde: ${formatPdfDate(filters.from)}`)
  if (filters.to !== '') labels.push(`Hasta: ${formatPdfDate(filters.to)}`)
  if (filters.personId !== '') labels.push(`Persona: ${people.find((person) => person.id === filters.personId)?.name ?? 'Persona no disponible'}`)
  labels.push(`Tipo: ${filters.movementType === 'all' ? 'Todos' : filters.movementType === 'contribution' ? 'Aportaciones' : 'Gastos'}`)
  return labels
}

function expenseAmountForReport(entry: Extract<OperationalHistoryEntry, { kind: 'expense' }>, personId: string): AmountInCents {
  if (personId === '') return entry.amountInCents
  return entry.allocations.find((allocation) => allocation.personId === personId)?.amountInCents ?? 0
}

/** Prepara el mismo resultado filtrado que muestra la pantalla, sin consultar ni recalcular repartos. */
export function prepareHistoricalPdfReport(
  groupName: string,
  entries: readonly OperationalHistoryEntry[],
  filters: HistoricalFilters,
  people: readonly Person[],
  generatedOn: string,
): HistoricalPdfReport | null {
  if (entries.length === 0) return null

  const movements = entries.map((entry): HistoricalPdfMovement => {
    if (entry.kind === 'contribution') {
      return {
        kind: 'contribution',
        date: entry.date,
        description: `${entry.isInheritedOpening ? 'Aportación de apertura heredada' : 'Aportación'} · ${entry.personName}`,
        amountInCents: entry.amountInCents,
      }
    }

    return {
      kind: 'expense',
      date: entry.date,
      description: `Gasto · ${entry.siteName} · ${entry.concept}`,
      amountInCents: expenseAmountForReport(entry, filters.personId),
    }
  })
  const totalContributionsInCents = movements
    .filter((movement) => movement.kind === 'contribution')
    .reduce((total, movement) => total + movement.amountInCents, 0)
  const totalExpensesInCents = movements
    .filter((movement) => movement.kind === 'expense')
    .reduce((total, movement) => total + movement.amountInCents, 0)

  return {
    groupName,
    generatedOn,
    filters: filterLabels(filters, people),
    movements,
    totalContributionsInCents,
    totalExpensesInCents,
    balanceInCents: totalContributionsInCents - totalExpensesInCents,
  }
}

function wrapPdfLine(value: string, maxLength = 88): readonly string[] {
  const words = value.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const nextLine = line === '' ? word : `${line} ${word}`
    if (nextLine.length > maxLength && line !== '') {
      lines.push(line)
      line = word
    } else {
      line = nextLine
    }
  }
  if (line !== '') lines.push(line)
  return lines
}

function escapePdfText(value: string): string {
  return value.replace(/([\\()])/g, '\\$1')
}

function visualText(font: 'F1' | 'F2', size: number, x: number, y: number, value: string, color = '0.12 0.16 0.15'): string {
  return `${color} rg\nBT\n/${font} ${size} Tf\n1 0 0 1 ${x} ${y} Tm\n(${escapePdfText(value)}) Tj\nET`
}

function visualRightText(font: 'F1' | 'F2', size: number, right: number, y: number, value: string, color?: string): string {
  return visualText(font, size, Math.max(40, right - value.length * size * 0.51), y, value, color)
}

function visualMovementLines(movement: HistoricalPdfMovement): readonly string[] {
  if (movement.kind === 'contribution') {
    const [, person = movement.description] = movement.description.split(' · ')
    return [person, `${formatPdfDate(movement.date)} · Aportación`]
  }
  const [, site = 'Gasto', concept = ''] = movement.description.split(' · ')
  return [site, `${formatPdfDate(movement.date)} · ${concept} · Gasto`]
}

interface VisualPdfPage {
  commands: string[]
  y: number
}

function addVisualHeader(page: VisualPdfPage, report: HistoricalPdfReport, pageNumber: number): void {
  page.commands.push('0.10 0.36 0.30 rg\n36 802 523 4 re f')
  page.commands.push(visualText('F2', pageNumber === 1 ? 18 : 11, 40, 776, pageNumber === 1 ? 'GASTOS DEL GRUPO' : `GASTOS DEL GRUPO · Histórico · ${report.groupName}`, '0.08 0.24 0.20'))
  if (pageNumber === 1) {
    page.commands.push(visualText('F1', 12, 40, 754, 'Histórico', '0.28 0.36 0.33'))
    page.commands.push(visualText('F2', 10, 40, 728, `Grupo: ${report.groupName}`))
    page.commands.push(visualText('F1', 9, 40, 713, `Generado: ${report.generatedOn}`, '0.35 0.43 0.40'))
    let filterY = 690
    report.filters.forEach((filter) => {
      page.commands.push(visualText('F1', 8.5, 40, filterY, filter, '0.35 0.43 0.40'))
      filterY -= 13
    })
    page.y = filterY - 16
  } else page.y = 744
  page.commands.push(visualText('F2', 9, 40, page.y, 'MOVIMIENTOS', '0.10 0.36 0.30'))
  page.y -= 18
}

function newVisualPage(report: HistoricalPdfReport, pageNumber: number): VisualPdfPage {
  const page: VisualPdfPage = { commands: [], y: 0 }
  addVisualHeader(page, report, pageNumber)
  return page
}

function addVisualMovement(page: VisualPdfPage, movement: HistoricalPdfMovement): void {
  const [title, detail] = visualMovementLines(movement)
  const detailLines = wrapPdfLine(detail, 66)
  const height = 31 + detailLines.length * 11
  page.commands.push(`0.88 0.91 0.89 RG\n0.5 w\n40 ${page.y - height + 6} m\n555 ${page.y - height + 6} l\nS`)
  page.commands.push(visualText('F2', 10.5, 40, page.y, title))
  page.commands.push(visualRightText('F2', 10.5, 555, page.y, formatPdfMoney(movement.amountInCents), movement.kind === 'contribution' ? '0.08 0.42 0.25' : '0.65 0.20 0.18'))
  detailLines.forEach((line, index) => page.commands.push(visualText('F1', 8.5, 40, page.y - 15 - index * 11, line, '0.36 0.43 0.41')))
  page.y -= height
}

function addVisualSummary(page: VisualPdfPage, report: HistoricalPdfReport): void {
  page.commands.push(`0.92 0.96 0.94 rg\n40 ${page.y - 70} 515 70 re f`)
  page.commands.push(visualText('F2', 10, 52, page.y - 17, 'RESUMEN FINAL', '0.10 0.36 0.30'))
  page.commands.push(visualText('F1', 9, 52, page.y - 35, 'Total aportaciones'))
  page.commands.push(visualRightText('F2', 9, 540, page.y - 35, formatPdfMoney(report.totalContributionsInCents), '0.08 0.42 0.25'))
  page.commands.push(visualText('F1', 9, 52, page.y - 50, 'Total gastos'))
  page.commands.push(visualRightText('F2', 9, 540, page.y - 50, formatPdfMoney(report.totalExpensesInCents), '0.65 0.20 0.18'))
  page.commands.push(visualText('F2', 11, 52, page.y - 66, 'Balance', '0.08 0.24 0.20'))
  page.commands.push(visualRightText('F2', 11, 540, page.y - 66, formatPdfMoney(report.balanceInCents), report.balanceInCents >= 0 ? '0.08 0.42 0.25' : '0.65 0.20 0.18'))
  page.y -= 82
}

/** Plantilla visual reutilizable: cabecera, movimientos y resumen, sin modificar el informe recibido. */
export function createHistoricalPdfPages(report: HistoricalPdfReport): readonly string[] {
  const pages: VisualPdfPage[] = [newVisualPage(report, 1)]
  let page = pages[0]
  report.movements.forEach((movement) => {
    const height = 31 + wrapPdfLine(visualMovementLines(movement)[1], 66).length * 11
    if (page.y - height < 92) {
      page = newVisualPage(report, pages.length + 1)
      pages.push(page)
    }
    addVisualMovement(page, movement)
  })
  if (page.y - 82 < 62) {
    page = newVisualPage(report, pages.length + 1)
    pages.push(page)
  }
  addVisualSummary(page, report)
  return pages.map((item, index) => `${item.commands.join('\n')}\n${visualText('F1', 8, 40, 28, `Página ${index + 1} de ${pages.length}`, '0.45 0.50 0.48')}`)
}

export interface StyledPdfRow {
  title: string
  detail?: string
  amountInCents: AmountInCents
  tone?: 'positive' | 'negative' | 'neutral'
}

export interface StyledPdfSummaryLine {
  label: string
  amountInCents: AmountInCents
  tone?: 'positive' | 'negative' | 'neutral'
}

export interface StyledPdfReport {
  title: string
  sectionTitle: string
  groupName: string
  generatedOn: string
  filters: readonly string[]
  rows: readonly StyledPdfRow[]
  summary: readonly StyledPdfSummaryLine[]
}

function toneColor(tone: StyledPdfRow['tone']): string {
  if (tone === 'negative') return '0.65 0.20 0.18'
  if (tone === 'positive') return '0.08 0.42 0.25'
  return '0.08 0.24 0.20'
}

/** Plantilla V4 para informes tabulares: reutiliza cabecera, filas y resumen del PDF histórico. */
export function createStyledPdfPages(report: StyledPdfReport): readonly string[] {
  const pages: VisualPdfPage[] = []
  function startPage(): VisualPdfPage {
    const page: VisualPdfPage = { commands: [], y: 0 }
    const isFirst = pages.length === 0
    page.commands.push('0.10 0.36 0.30 rg\n36 802 523 4 re f')
    page.commands.push(visualText('F2', isFirst ? 18 : 11, 40, 776, isFirst ? 'GASTOS DEL GRUPO' : `GASTOS DEL GRUPO · ${report.title} · ${report.groupName}`, '0.08 0.24 0.20'))
    if (isFirst) {
      page.commands.push(visualText('F1', 12, 40, 754, report.title, '0.28 0.36 0.33'))
      page.commands.push(visualText('F2', 10, 40, 728, `Grupo: ${report.groupName}`))
      page.commands.push(visualText('F1', 9, 40, 713, `Generado: ${report.generatedOn}`, '0.35 0.43 0.40'))
      let filterY = 690
      report.filters.forEach((filter) => { page.commands.push(visualText('F1', 8.5, 40, filterY, filter, '0.35 0.43 0.40')); filterY -= 13 })
      page.y = filterY - 16
    } else page.y = 744
    page.commands.push(visualText('F2', 9, 40, page.y, report.sectionTitle, '0.10 0.36 0.30'))
    page.y -= 18
    pages.push(page)
    return page
  }
  let page = startPage()
  report.rows.forEach((row) => {
    const detailLines = row.detail === undefined ? [] : wrapPdfLine(row.detail, 66)
    const height = 25 + detailLines.length * 11
    if (page.y - height < 92) page = startPage()
    page.commands.push(`0.88 0.91 0.89 RG\n0.5 w\n40 ${page.y - height + 5} m\n555 ${page.y - height + 5} l\nS`)
    page.commands.push(visualText('F2', 10.5, 40, page.y, row.title))
    page.commands.push(visualRightText('F2', 10.5, 555, page.y, formatPdfMoney(row.amountInCents), toneColor(row.tone)))
    detailLines.forEach((line, index) => page.commands.push(visualText('F1', 8.5, 40, page.y - 15 - index * 11, line, '0.36 0.43 0.41')))
    page.y -= height
  })
  const summaryHeight = 25 + report.summary.length * 16
  if (page.y - summaryHeight < 62) page = startPage()
  page.commands.push(`0.92 0.96 0.94 rg\n40 ${page.y - summaryHeight} 515 ${summaryHeight} re f`)
  page.commands.push(visualText('F2', 10, 52, page.y - 17, 'RESUMEN FINAL', '0.10 0.36 0.30'))
  report.summary.forEach((line, index) => {
    const y = page.y - 35 - index * 16
    page.commands.push(visualText(index === report.summary.length - 1 ? 'F2' : 'F1', index === report.summary.length - 1 ? 11 : 9, 52, y, line.label))
    page.commands.push(visualRightText('F2', index === report.summary.length - 1 ? 11 : 9, 540, y, formatPdfMoney(line.amountInCents), toneColor(line.tone)))
  })
  return pages.map((item, index) => `${item.commands.join('\n')}\n${visualText('F1', 8, 40, 28, `Página ${index + 1} de ${pages.length}`, '0.45 0.50 0.48')}`)
}

function encodeWinAnsi(value: string): Uint8Array {
  const winAnsi: Readonly<Record<string, number>> = { '€': 128, 'Á': 193, 'É': 201, 'Í': 205, 'Ñ': 209, 'Ó': 211, 'Ú': 218, 'Ü': 220, 'á': 225, 'é': 233, 'í': 237, 'ñ': 241, 'ó': 243, 'ú': 250, 'ü': 252 }
  return Uint8Array.from([...value].map((character) => winAnsi[character] ?? (character.charCodeAt(0) <= 255 ? character.charCodeAt(0) : 63)))
}

/** Genera bytes PDF locales usando WinAnsi para conservar tildes, ñ y €. */
function createPdfDocumentFromPages(pages: readonly string[]): Blob {
  const pageIds = pages.map((_, index) => 5 + index)
  const contentIds = pages.map((_, index) => 5 + pages.length + index)
  const objects: string[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  pages.forEach((content, index) => {
    objects[pageIds[index]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[index]} 0 R >>`
    objects[contentIds[index]] = `<< /Length ${encodeWinAnsi(content).length} >>\nstream\n${content}\nendstream`
  })
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encodeWinAnsi(pdf).length
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xrefOffset = encodeWinAnsi(pdf).length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  const pdfBytes = encodeWinAnsi(pdf)
  const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer
  return new Blob([pdfBuffer], { type: 'application/pdf' })
}

export function createHistoricalPdfDocument(report: HistoricalPdfReport): Blob {
  return createPdfDocumentFromPages(createHistoricalPdfPages(report))
}

export function createStyledPdfDocument(report: StyledPdfReport): Blob {
  return createPdfDocumentFromPages(createStyledPdfPages(report))
}

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grupo'
}

export function historicalPdfFilename(groupName: string, filters: HistoricalFilters): string {
  return `historico-${slug(groupName)}-${filters.from || 'sin-desde'}-${filters.to || 'sin-hasta'}.pdf`
}

export function downloadHistoricalPdf(report: HistoricalPdfReport, filename: string): void {
  const url = URL.createObjectURL(createHistoricalPdfDocument(report))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
