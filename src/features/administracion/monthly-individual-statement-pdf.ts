import { formatPdfMoney } from './historical-pdf'
import type { MonthlyIndividualMovement, MonthlyIndividualStatement } from './monthly-individual-statement'

export interface MonthlyIndividualPdfReport extends MonthlyIndividualStatement { groupName: string; generatedOn: string }
interface PdfPage { commands: string[]; y: number }

const W = 306
const H = 544
const LEFT = 20
const RIGHT = 286
const DATE_W = 48

function escapeText(value: string): string { return value.replace(/([\\()])/g, '\\$1') }
function encode(value: string): Uint8Array {
  const winAnsi: Readonly<Record<string, number>> = { '€': 128, 'Á': 193, 'É': 201, 'Í': 205, 'Ñ': 209, 'Ó': 211, 'Ú': 218, 'Ü': 220, 'á': 225, 'é': 233, 'í': 237, 'ñ': 241, 'ó': 243, 'ú': 250, 'ü': 252 }
  return Uint8Array.from([...value].map((character) => winAnsi[character] ?? (character.charCodeAt(0) <= 255 ? character.charCodeAt(0) : 63)))
}
function text(font: 'F1' | 'F2', size: number, x: number, y: number, value: string, color = '0.09 0.13 0.11'): string {
  return `${color} rg\nBT\n/${font} ${size} Tf\n1 0 0 1 ${x} ${y} Tm\n(${escapeText(value)}) Tj\nET`
}
function rightText(font: 'F1' | 'F2', size: number, right: number, y: number, value: string, color?: string): string {
  return text(font, size, Math.max(LEFT, right - encode(value).length * size * 0.51), y, value, color)
}
function wrap(value: string, max: number): readonly string[] {
  const lines: string[] = []
  let line = ''
  value.split(/\s+/).forEach((word) => {
    const next = line === '' ? word : `${line} ${word}`
    if (next.length > max && line !== '') { lines.push(line); line = word } else line = next
  })
  if (line !== '') lines.push(line)
  return lines.length === 0 ? [''] : lines
}
function day(date: string): string { return `${date.slice(8, 10)}/${date.slice(5, 7)}` }
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const value = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
  return value.charAt(0).toUpperCase() + value.slice(1)
}
function requiredHeight(movement: MonthlyIndividualMovement): number { return 21 + wrap(movement.concept, 27).length * 12 + (movement.kind === 'contribution' ? 25 : 0) }

function addHeader(page: PdfPage, report: MonthlyIndividualPdfReport, first: boolean): void {
  if (first) {
    page.commands.push(text('F2', 17, LEFT, 508, 'EXTRACTO MENSUAL', '0.06 0.27 0.22'))
    page.commands.push(text('F1', 10, LEFT, 492, 'Detalle individual de movimientos', '0.38 0.44 0.42'))
    page.commands.push('0.95 0.97 0.96 rg\n20 443 266 39 re f')
    page.commands.push(text('F2', 7.5, 27, 469, 'PERSONA', '0.38 0.44 0.42'))
    page.commands.push(text('F2', 7.5, 174, 469, 'MES', '0.38 0.44 0.42'))
    page.commands.push(text('F2', 12, 27, 451, report.personName))
    page.commands.push(text('F2', 12, 174, 451, monthLabel(report.month)))
    page.commands.push('0.90 0.95 0.93 rg\n20 405 266 29 re f')
    page.commands.push(text('F2', 11.5, 27, 415, 'Saldo al comenzar el mes'))
    page.commands.push(rightText('F2', 12, 279, 415, formatPdfMoney(report.openingBalanceInCents), '0.06 0.27 0.22'))
    page.y = 378
  } else {
    page.commands.push(text('F2', 9, LEFT, 514, `EXTRACTO MENSUAL - ${report.personName} - ${monthLabel(report.month)}`, '0.06 0.27 0.22'))
    page.y = 492
  }
  page.commands.push(text('F2', 8, LEFT + 5, page.y, 'FECHA', '0.38 0.44 0.42'))
  page.commands.push(text('F2', 8, LEFT + DATE_W + 3, page.y, 'CONCEPTO', '0.38 0.44 0.42'))
  page.commands.push(rightText('F2', 8, RIGHT - 5, page.y, 'IMPORTE', '0.38 0.44 0.42'))
  page.commands.push(`0.85 0.89 0.87 RG\n0.6 w\n${LEFT} ${page.y - 7} m\n${RIGHT} ${page.y - 7} l\nS`)
  page.y -= 21
}

function startPage(report: MonthlyIndividualPdfReport, pages: PdfPage[]): PdfPage {
  const page: PdfPage = { commands: [], y: 0 }
  addHeader(page, report, pages.length === 0)
  pages.push(page)
  return page
}

function addMovement(page: PdfPage, movement: MonthlyIndividualMovement): void {
  const lines = wrap(movement.concept, 27)
  const rowHeight = 14 + lines.length * 12
  const bottom = page.y - rowHeight
  const contribution = movement.kind === 'contribution'
  page.commands.push(`${contribution ? '0.92 0.97 0.94' : '1.00 0.94 0.93'} rg\n${LEFT} ${bottom} ${RIGHT - LEFT} ${rowHeight} re f`)
  page.commands.push(text('F2', 9, LEFT + 5, page.y - 16, day(movement.date)))
  lines.forEach((line, index) => page.commands.push(text('F1', 9.5, LEFT + DATE_W + 3, page.y - 16 - index * 12, line)))
  const amount = contribution ? `${movement.amountInCents >= 0 ? '+' : ''}${formatPdfMoney(movement.amountInCents)}` : `-${formatPdfMoney(Math.abs(movement.amountInCents))}`
  page.commands.push(rightText('F2', 9.5, RIGHT - 5, page.y - 16, amount, contribution ? '0.07 0.48 0.29' : '0.72 0.21 0.19'))
  page.y = bottom
  if (movement.kind === 'contribution') {
    page.commands.push(`0.86 0.95 0.90 rg\n${LEFT} ${page.y - 25} ${RIGHT - LEFT} 25 re f`)
    page.commands.push(text('F2', 9, LEFT + DATE_W + 3, page.y - 16, 'Disponible', '0.06 0.27 0.22'))
    page.commands.push(rightText('F2', 9.5, RIGHT - 5, page.y - 16, formatPdfMoney(movement.availableInCents), '0.06 0.27 0.22'))
    page.y -= 25
  }
  page.y -= 7
}

function addClosing(page: PdfPage, report: MonthlyIndividualPdfReport): void {
  page.commands.push(`0.06 0.27 0.22 rg\n${LEFT} ${page.y - 38} ${RIGHT - LEFT} 38 re f`)
  page.commands.push(text('F2', 11.5, LEFT + 8, page.y - 24, 'SALDO FINAL DEL MES', '1 1 1'))
  page.commands.push(rightText('F2', 13, RIGHT - 8, page.y - 24, formatPdfMoney(report.closingBalanceInCents), '1 1 1'))
  page.y -= 49
  if (report.movements.length === 0) page.commands.push(text('F1', 8.5, LEFT, page.y, 'Mes sin movimientos. El saldo final coincide con el inicial.', '0.38 0.44 0.42'))
}

export function createMonthlyIndividualPdfPages(report: MonthlyIndividualPdfReport): readonly string[] {
  const pages: PdfPage[] = []
  let page = startPage(report, pages)
  report.movements.forEach((movement) => {
    if (page.y - requiredHeight(movement) < 53) page = startPage(report, pages)
    addMovement(page, movement)
  })
  if (page.y - 50 < 53) page = startPage(report, pages)
  addClosing(page, report)
  return pages.map((item, index) => {
    item.commands.push(`0.85 0.89 0.87 RG\n0.5 w\n${LEFT} 24 m\n${RIGHT} 24 l\nS`)
    item.commands.push(text('F1', 6.5, LEFT, 14, 'Gastos del Grupo V4', '0.38 0.44 0.42'))
    item.commands.push(rightText('F1', 6.5, RIGHT, 14, `Página ${index + 1} de ${pages.length}`, '0.38 0.44 0.42'))
    return item.commands.join('\n')
  })
}

function createPdf(pages: readonly string[]): Blob {
  const pageIds = pages.map((_, index) => 5 + index)
  const contentIds = pages.map((_, index) => 5 + pages.length + index)
  const objects: string[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  pages.forEach((content, index) => {
    objects[pageIds[index]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[index]} 0 R >>`
    objects[contentIds[index]] = `<< /Length ${encode(content).length} >>\nstream\n${content}\nendstream`
  })
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let id = 1; id < objects.length; id += 1) { offsets[id] = encode(pdf).length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n` }
  const xref = encode(pdf).length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  const bytes = encode(pdf)
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'application/pdf' })
}

export function createMonthlyIndividualPdfDocument(report: MonthlyIndividualPdfReport): Blob { return createPdf(createMonthlyIndividualPdfPages(report)) }
function slug(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'persona' }
export function monthlyIndividualPdfFilename(personName: string, month: string): string { return `extracto-mensual-${slug(personName)}-${month}.pdf` }
export function downloadMonthlyIndividualPdf(report: MonthlyIndividualPdfReport, filename: string): void {
  const url = URL.createObjectURL(createMonthlyIndividualPdfDocument(report))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
