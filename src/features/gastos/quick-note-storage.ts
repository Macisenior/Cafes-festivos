import type { GroupId } from '../../domain/entities'
import {
  FIXED_QUICK_NOTE_CONSUMPTIONS,
  QUICK_NOTE_VERSION,
  createEmptyQuickNote,
  type QuickNoteConsumption,
  type QuickNotePersonEntry,
  type QuickNoteState,
} from './quick-note'

export const QUICK_NOTE_STORAGE_PREFIX = 'gastos-del-grupo-v4:quick-note:v1'

export interface QuickNoteStoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function quickNoteStorageKey(groupId: GroupId): string {
  return `${QUICK_NOTE_STORAGE_PREFIX}:${groupId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCustomConsumptions(value: unknown): readonly QuickNoteConsumption[] {
  if (!Array.isArray(value)) return []
  const fixedNames = new Set(FIXED_QUICK_NOTE_CONSUMPTIONS.map((item) => item.name.toLocaleLowerCase('es')))
  const usedIds = new Set<string>()
  const usedNames = new Set<string>(fixedNames)

  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || candidate.kind !== 'custom') return []
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
    const name = typeof candidate.name === 'string' ? candidate.name.trim().replace(/\s+/g, ' ') : ''
    const normalizedName = name.toLocaleLowerCase('es')
    if (id === '' || name === '' || usedIds.has(id) || usedNames.has(normalizedName)) return []
    usedIds.add(id)
    usedNames.add(normalizedName)
    return [{ id, name, kind: 'custom' as const }]
  })
}

function parsePeople(value: unknown, allowedConsumptionIds: ReadonlySet<string>): Readonly<Record<string, QuickNotePersonEntry>> {
  if (!isRecord(value)) return {}
  const people: Record<string, QuickNotePersonEntry> = {}

  for (const [personId, candidate] of Object.entries(value)) {
    if (!isRecord(candidate) || typeof candidate.name !== 'string' || !isRecord(candidate.quantities)) continue
    const quantities: Record<string, number> = {}
    for (const [consumptionId, quantity] of Object.entries(candidate.quantities)) {
      if (allowedConsumptionIds.has(consumptionId) && Number.isInteger(quantity) && (quantity as number) > 0) {
        quantities[consumptionId] = quantity as number
      }
    }
    if (Object.keys(quantities).length > 0) {
      people[personId] = { name: candidate.name.trim() || 'Persona', quantities }
    }
  }

  return people
}

export function parseQuickNote(rawValue: string | null, groupId: GroupId): QuickNoteState {
  if (rawValue === null) return createEmptyQuickNote(groupId)

  try {
    const value: unknown = JSON.parse(rawValue)
    if (!isRecord(value) || value.version !== QUICK_NOTE_VERSION || value.groupId !== groupId) {
      return createEmptyQuickNote(groupId)
    }
    const customConsumptions = parseCustomConsumptions(value.customConsumptions)
    const allowedConsumptionIds = new Set([
      ...FIXED_QUICK_NOTE_CONSUMPTIONS.map((consumption) => consumption.id),
      ...customConsumptions.map((consumption) => consumption.id),
    ])
    return {
      version: QUICK_NOTE_VERSION,
      groupId,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
      customConsumptions,
      people: parsePeople(value.people, allowedConsumptionIds),
    }
  } catch {
    return createEmptyQuickNote(groupId)
  }
}

export function restoreQuickNote(storage: QuickNoteStoragePort, groupId: GroupId): QuickNoteState {
  try {
    return parseQuickNote(storage.getItem(quickNoteStorageKey(groupId)), groupId)
  } catch {
    return createEmptyQuickNote(groupId)
  }
}

export function saveQuickNote(storage: QuickNoteStoragePort, state: QuickNoteState): void {
  storage.setItem(quickNoteStorageKey(state.groupId), JSON.stringify(state))
}

export function clearQuickNote(storage: QuickNoteStoragePort, groupId: GroupId): void {
  storage.removeItem(quickNoteStorageKey(groupId))
}
