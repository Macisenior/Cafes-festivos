import { createHash, randomUUID } from 'node:crypto'
import { createGroupFinancialView, type GroupFinancialEntities } from '../../src/domain/financial-adapter'
import {
  convertFirestoreV3GroupToV4,
  type FirestoreV3Contribution,
  type FirestoreV3Expense,
  type FirestoreV3GroupDocument,
  type FirestoreV3Person,
} from '../../src/infrastructure/firestore/v3-group-converter'

export class V3BackupMaintenanceError extends Error {}

export interface V3BackupExpectedSummary {
  peopleCount: number
  contributionsCount: number
  expensesCount: number
  contributedInCents: number
  spentInCents: number
  availableInCents: number
}

export interface V3BackupReplacementRequest {
  targetGroupId: string
  sourceGroupId: string
  backupJson: string
  expected?: V3BackupExpectedSummary
}

export interface V3BackupReplacementConfirmation extends V3BackupReplacementRequest {
  confirmationFingerprint: string
}

export interface V3BackupReplacementPreview {
  targetGroupId: string
  sourceGeneratedAt: string
  fingerprint: string
  before: V3BackupExpectedSummary
  after: V3BackupExpectedSummary
  openingContributionsCount: number
}

export interface MaintenanceBackup {
  id: string
  targetGroupId: string
  createdAt: string
  sourceGeneratedAt: string
  entities: GroupFinancialEntities
}

export interface V3BackupReplacementPort {
  readGroup(groupId: string): Promise<GroupFinancialEntities>
  saveMaintenanceBackup(backup: MaintenanceBackup): Promise<void>
  replaceGroup(groupId: string, entities: GroupFinancialEntities): Promise<void>
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('/')) {
    throw new V3BackupMaintenanceError(`${label} no es válido.`)
  }
}

function assertArray(value: unknown, label: string): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) throw new V3BackupMaintenanceError(`${label} debe ser una lista.`)
}

function stableMissingContributionId(groupId: string, contribution: Record<string, unknown>, occurrence: number): string {
  const material = JSON.stringify({
    groupId,
    personId: contribution.personaId,
    amount: contribution.amount,
    date: contribution.date,
    occurrence,
  })
  return `v3-backup-contribution-${createHash('sha256').update(material).digest('hex').slice(0, 24)}`
}

/** Valida el JSON V3 y completa únicamente IDs de aportaciones ausentes antes del conversor histórico. */
export function adaptV3JsonBackup(
  backupJson: string,
  targetGroupId: string,
  targetGroupName: string,
): { generatedAt: string; document: FirestoreV3GroupDocument } {
  assertId(targetGroupId, 'El grupo objetivo')
  if (typeof targetGroupName !== 'string' || targetGroupName.trim() === '') {
    throw new V3BackupMaintenanceError('El grupo objetivo no tiene nombre visible.')
  }

  let raw: unknown
  try { raw = JSON.parse(backupJson) as unknown } catch { throw new V3BackupMaintenanceError('La copia V3 no es JSON válido.') }
  if (!isRecord(raw)) throw new V3BackupMaintenanceError('La copia V3 debe ser un objeto.')
  if (typeof raw.fecha !== 'string' || raw.fecha.trim() === '') throw new V3BackupMaintenanceError('Falta la fecha de generación de la copia V3.')
  assertArray(raw.personas, 'personas')
  assertArray(raw.aportaciones, 'aportaciones')
  assertArray(raw.gastos, 'gastos')

  const people = raw.personas.map((value): FirestoreV3Person => {
    if (!isRecord(value) || (typeof value.id !== 'string' && typeof value.id !== 'number') || typeof value.nombre !== 'string' || !Number.isFinite(value.aportado)) {
      throw new V3BackupMaintenanceError('Una persona de V3 no contiene identidad, nombre o aportado válidos.')
    }
    return value as unknown as FirestoreV3Person
  })
  const personIds = new Set<string>()
  people.forEach((person) => {
    const id = String(person.id)
    if (personIds.has(id)) throw new V3BackupMaintenanceError(`La copia V3 contiene una persona duplicada: ${id}.`)
    personIds.add(id)
  })

  const missingOccurrences = new Map<string, number>()
  const contributions = raw.aportaciones.map((value): FirestoreV3Contribution => {
    if (!isRecord(value) || (typeof value.personaId !== 'string' && typeof value.personaId !== 'number') || !Number.isFinite(value.amount) || typeof value.date !== 'string') {
      throw new V3BackupMaintenanceError('Una aportación de V3 no contiene persona, importe o fecha válidos.')
    }
    if (!personIds.has(String(value.personaId))) throw new V3BackupMaintenanceError('Una aportación V3 referencia una persona inexistente.')
    const id = value.id
    if (typeof id === 'string' || typeof id === 'number') return value as unknown as FirestoreV3Contribution
    const key = JSON.stringify({ personId: value.personaId, amount: value.amount, date: value.date })
    const occurrence = (missingOccurrences.get(key) ?? 0) + 1
    missingOccurrences.set(key, occurrence)
    return { ...(value as unknown as Omit<FirestoreV3Contribution, 'id'>), id: stableMissingContributionId(targetGroupId, value, occurrence) }
  })

  const expenseIds = new Set<string>()
  const expenses = raw.gastos.map((value): FirestoreV3Expense => {
    if (!isRecord(value) || (typeof value.id !== 'string' && typeof value.id !== 'number') || !Number.isFinite(value.monto) || typeof value.fecha !== 'string' || !Array.isArray(value.participantes)) {
      throw new V3BackupMaintenanceError('Un gasto de V3 no contiene identificador, importe, fecha o participantes válidos.')
    }
    const id = String(value.id)
    if (expenseIds.has(id)) throw new V3BackupMaintenanceError(`La copia V3 contiene un gasto duplicado: ${id}.`)
    expenseIds.add(id)
    if (value.participantes.some((personId) => !personIds.has(String(personId)))) {
      throw new V3BackupMaintenanceError('Un gasto V3 referencia una persona inexistente.')
    }
    return value as unknown as FirestoreV3Expense
  })

  return {
    generatedAt: raw.fecha,
    document: { nombreVisible: targetGroupName, personas: people, aportaciones: contributions, gastos: expenses },
  }
}

export function summarizeV3Replacement(entities: GroupFinancialEntities): V3BackupExpectedSummary {
  const view = createGroupFinancialView(entities)
  if (!view.groupIntegrity.isConsistent || view.expenseIntegrity.some((item) => !item.isConsistent) || view.personIntegrity.some((item) => !item.isConsistent)) {
    throw new V3BackupMaintenanceError('La conversión V4 no supera las comprobaciones de integridad.')
  }
  return {
    peopleCount: entities.people.length,
    contributionsCount: entities.contributions.length,
    expensesCount: entities.expenses.length,
    contributedInCents: view.groupBalance.contributedInCents,
    spentInCents: view.groupBalance.spentInCents,
    availableInCents: view.groupBalance.availableInCents,
  }
}

function sameSummary(left: V3BackupExpectedSummary, right: V3BackupExpectedSummary): boolean {
  return Object.keys(left).every((key) => left[key as keyof V3BackupExpectedSummary] === right[key as keyof V3BackupExpectedSummary])
}

function fingerprint(request: V3BackupReplacementRequest, generatedAt: string, summary: V3BackupExpectedSummary): string {
  return createHash('sha256').update(JSON.stringify({ targetGroupId: request.targetGroupId, sourceGroupId: request.sourceGroupId, generatedAt, summary })).digest('hex')
}

function createConvertedEntities(request: V3BackupReplacementRequest, current: GroupFinancialEntities) {
  assertId(request.targetGroupId, 'El grupo objetivo')
  assertId(request.sourceGroupId, 'El grupo fuente')
  if (request.sourceGroupId !== request.targetGroupId) {
    throw new V3BackupMaintenanceError('El grupo fuente declarado no coincide con el grupo V4 objetivo.')
  }
  if (current.group.id !== request.targetGroupId) throw new V3BackupMaintenanceError('El grupo objetivo no existe en V4.')
  const adapted = adaptV3JsonBackup(request.backupJson, request.targetGroupId, current.group.name)
  const entities = convertFirestoreV3GroupToV4(request.targetGroupId, adapted.document)
  const after = summarizeV3Replacement(entities)
  if (request.expected && !sameSummary(after, request.expected)) {
    throw new V3BackupMaintenanceError('La copia V3 no coincide con la referencia esperada antes del reemplazo.')
  }
  return { generatedAt: adapted.generatedAt, entities, after }
}

export async function previewV3BackupReplacement(request: V3BackupReplacementRequest, port: Pick<V3BackupReplacementPort, 'readGroup'>): Promise<V3BackupReplacementPreview> {
  const current = await port.readGroup(request.targetGroupId)
  const before = summarizeV3Replacement(current)
  const converted = createConvertedEntities(request, current)
  return {
    targetGroupId: request.targetGroupId,
    sourceGeneratedAt: converted.generatedAt,
    fingerprint: fingerprint(request, converted.generatedAt, converted.after),
    before,
    after: converted.after,
    openingContributionsCount: converted.entities.contributions.filter((contribution) => contribution.source === 'v3-opening').length,
  }
}

/** Guarda una copia V4 previa, sustituye solo el grupo elegido y revierte si falla cualquier fase posterior. */
export async function replaceV3BackupGroup(
  request: V3BackupReplacementConfirmation,
  port: V3BackupReplacementPort,
): Promise<V3BackupReplacementPreview> {
  const current = await port.readGroup(request.targetGroupId)
  const converted = createConvertedEntities(request, current)
  const before = summarizeV3Replacement(current)
  const expectedFingerprint = fingerprint(request, converted.generatedAt, converted.after)
  if (request.confirmationFingerprint !== expectedFingerprint) {
    throw new V3BackupMaintenanceError('La confirmación no corresponde a la vista previa actual.')
  }

  const backup: MaintenanceBackup = {
    id: `v3-rebuild-${request.targetGroupId}-${randomUUID()}`,
    targetGroupId: request.targetGroupId,
    createdAt: new Date().toISOString(),
    sourceGeneratedAt: converted.generatedAt,
    entities: current,
  }
  await port.saveMaintenanceBackup(backup)

  try {
    await port.replaceGroup(request.targetGroupId, converted.entities)
    const reread = await port.readGroup(request.targetGroupId)
    const final = summarizeV3Replacement(reread)
    if (!sameSummary(final, converted.after)) {
      throw new V3BackupMaintenanceError('La relectura final no coincide con la vista previa validada.')
    }
  } catch (error) {
    try {
      await port.replaceGroup(request.targetGroupId, current)
    } catch {
      throw new V3BackupMaintenanceError('El reemplazo falló y la reversión automática tampoco se completó. La copia V4 previa permanece guardada.')
    }
    throw error instanceof Error ? error : new V3BackupMaintenanceError('El reemplazo controlado no se ha completado.')
  }

  return {
    targetGroupId: request.targetGroupId,
    sourceGeneratedAt: converted.generatedAt,
    fingerprint: expectedFingerprint,
    before,
    after: converted.after,
    openingContributionsCount: converted.entities.contributions.filter((contribution) => contribution.source === 'v3-opening').length,
  }
}

