import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'

export const V4_BACKUP_FORMAT = 'gastos-del-grupo-v4-backup' as const
export const V4_BACKUP_VERSION = 1 as const

export interface V4Backup {
  format: typeof V4_BACKUP_FORMAT
  version: typeof V4_BACKUP_VERSION
  generatedAt: string
  groups: readonly GroupFinancialEntities[]
}

export interface V4BackupSummary { groups: number; people: number; contributions: number; expenses: number }

export function createV4Backup(groups: readonly GroupFinancialEntities[], generatedAt: string): V4Backup {
  return { format: V4_BACKUP_FORMAT, version: V4_BACKUP_VERSION, generatedAt, groups }
}

export function summarizeV4Backup(backup: V4Backup): V4BackupSummary {
  return backup.groups.reduce<V4BackupSummary>((summary, group) => ({
    groups: summary.groups + 1,
    people: summary.people + group.people.length,
    contributions: summary.contributions + group.contributions.length,
    expenses: summary.expenses + group.expenses.length,
  }), { groups: 0, people: 0, contributions: 0, expenses: 0 })
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function hasString(value: unknown): value is string { return typeof value === 'string' && value.trim() !== '' }
function hasInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) }
function validDate(value: unknown): boolean { return value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) }

function validGroup(value: unknown): value is Group { return isRecord(value) && hasString(value.id) && hasString(value.name) && typeof value.isMainGroup === 'boolean' && Array.isArray(value.siteOptions) }
function validPerson(value: unknown, groupId: string): value is Person { return isRecord(value) && hasString(value.id) && value.groupId === groupId && hasString(value.name) && typeof value.phone === 'string' && typeof value.isActive === 'boolean' }
function validContribution(value: unknown, groupId: string): value is Contribution { return isRecord(value) && hasString(value.id) && value.groupId === groupId && hasString(value.personId) && validDate(value.date) && hasInteger(value.amountInCents) && (value.source === undefined || value.source === 'user' || value.source === 'v3-opening') }
function validExpense(value: unknown, groupId: string): value is Expense { return isRecord(value) && hasString(value.id) && value.groupId === groupId && hasString(value.date) && hasString(value.siteName) && hasString(value.concept) && hasInteger(value.totalInCents) && Array.isArray(value.participantIds) && isRecord(value.distribution) && Array.isArray(value.allocations) }

/** Valida todo el archivo antes de que la restauración pueda recibirlo. */
export function validateV4Backup(value: unknown): V4Backup {
  if (!isRecord(value) || value.format !== V4_BACKUP_FORMAT || value.version !== V4_BACKUP_VERSION || !hasString(value.generatedAt) || !Array.isArray(value.groups)) throw new Error('El archivo no es una copia de seguridad V4 válida o su versión no es compatible.')
  const ids = new Set<string>()
  const groups = value.groups.map((entry): GroupFinancialEntities => {
    if (!isRecord(entry) || !validGroup(entry.group) || !Array.isArray(entry.people) || !Array.isArray(entry.contributions) || !Array.isArray(entry.expenses)) throw new Error('La estructura de un grupo de la copia no es válida.')
    const groupId = entry.group.id
    if (ids.has(groupId)) throw new Error('La copia contiene identificadores de grupo duplicados.')
    ids.add(groupId)
    if (!entry.people.every((person) => validPerson(person, groupId)) || !entry.contributions.every((contribution) => validContribution(contribution, groupId)) || !entry.expenses.every((expense) => validExpense(expense, groupId))) throw new Error(`Los datos del grupo ${groupId} no son válidos.`)
    return { group: entry.group, people: entry.people, contributions: entry.contributions, expenses: entry.expenses }
  })
  return { format: V4_BACKUP_FORMAT, version: V4_BACKUP_VERSION, generatedAt: value.generatedAt, groups }
}

export function parseV4Backup(json: string): V4Backup { try { return validateV4Backup(JSON.parse(json) as unknown) } catch (error) { throw error instanceof Error ? error : new Error('No se ha podido leer la copia V4.') } }
