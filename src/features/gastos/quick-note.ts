import type { GroupId, Person } from '../../domain/entities'
import type { PersonId } from '../../domain/reparto'

export const QUICK_NOTE_VERSION = 1

export const FIXED_QUICK_NOTE_CONSUMPTIONS = [
  { id: 'coffee', name: 'Café', kind: 'fixed' },
  { id: 'beer', name: 'Cerveza', kind: 'fixed' },
  { id: 'juice', name: 'Zumo', kind: 'fixed' },
  { id: 'moscatel', name: 'Moscatel', kind: 'fixed' },
] as const satisfies readonly QuickNoteConsumption[]

export interface QuickNoteConsumption {
  id: string
  name: string
  kind: 'fixed' | 'custom'
}

export interface QuickNotePersonEntry {
  name: string
  quantities: Readonly<Record<string, number>>
}

export interface QuickNoteState {
  version: typeof QUICK_NOTE_VERSION
  groupId: GroupId
  updatedAt: string
  customConsumptions: readonly QuickNoteConsumption[]
  people: Readonly<Record<PersonId, QuickNotePersonEntry>>
}

export interface QuickNoteSummaryItem {
  consumptionId: string
  consumptionName: string
  quantity: number
}

export interface QuickNotePersonSummary {
  personId: PersonId
  personName: string
  items: readonly QuickNoteSummaryItem[]
}

export class QuickNoteError extends Error {}

export function createEmptyQuickNote(groupId: GroupId): QuickNoteState {
  return {
    version: QUICK_NOTE_VERSION,
    groupId,
    updatedAt: new Date(0).toISOString(),
    customConsumptions: [],
    people: {},
  }
}

export function allQuickNoteConsumptions(state: QuickNoteState): readonly QuickNoteConsumption[] {
  return [...FIXED_QUICK_NOTE_CONSUMPTIONS, ...state.customConsumptions]
}

export function addCustomQuickNoteConsumption(
  state: QuickNoteState,
  name: string,
  id: string,
  updatedAt = new Date().toISOString(),
): QuickNoteState {
  const normalizedName = name.trim().replace(/\s+/g, ' ')
  if (normalizedName === '') throw new QuickNoteError('Escribe el nombre de la consumición.')
  if (id.trim() === '') throw new QuickNoteError('No se ha podido crear la consumición.')

  const alreadyExists = allQuickNoteConsumptions(state)
    .some((consumption) => consumption.name.localeCompare(normalizedName, 'es', { sensitivity: 'base' }) === 0)
  if (alreadyExists) throw new QuickNoteError('Esa consumición ya está disponible.')

  return {
    ...state,
    updatedAt,
    customConsumptions: [
      ...state.customConsumptions,
      { id, name: normalizedName, kind: 'custom' },
    ],
  }
}

export function changeQuickNoteQuantity(
  state: QuickNoteState,
  person: Person,
  consumptionId: string,
  delta: 1 | -1,
  updatedAt = new Date().toISOString(),
): QuickNoteState {
  if (person.groupId !== state.groupId || !person.isActive) {
    throw new QuickNoteError('La persona debe estar activa y pertenecer al grupo.')
  }
  if (!allQuickNoteConsumptions(state).some((consumption) => consumption.id === consumptionId)) {
    throw new QuickNoteError('La consumición no está disponible.')
  }

  const currentEntry = state.people[person.id]
  const currentQuantity = currentEntry?.quantities[consumptionId] ?? 0
  const nextQuantity = Math.max(0, currentQuantity + delta)
  const nextQuantities = { ...currentEntry?.quantities }

  if (nextQuantity === 0) delete nextQuantities[consumptionId]
  else nextQuantities[consumptionId] = nextQuantity

  const nextPeople = { ...state.people }
  if (Object.keys(nextQuantities).length === 0) delete nextPeople[person.id]
  else nextPeople[person.id] = { name: person.name, quantities: nextQuantities }

  return { ...state, updatedAt, people: nextPeople }
}

export function quickNoteQuantity(
  state: QuickNoteState,
  personId: PersonId,
  consumptionId: string,
): number {
  return state.people[personId]?.quantities[consumptionId] ?? 0
}

export function createQuickNoteSummary(state: QuickNoteState): readonly QuickNotePersonSummary[] {
  const consumptionsById = new Map(
    allQuickNoteConsumptions(state).map((consumption) => [consumption.id, consumption.name]),
  )

  return Object.entries(state.people)
    .map(([personId, entry]) => ({
      personId,
      personName: entry.name,
      items: Object.entries(entry.quantities)
        .filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0)
        .map(([consumptionId, quantity]) => ({
          consumptionId,
          consumptionName: consumptionsById.get(consumptionId) ?? 'Consumición',
          quantity,
        })),
    }))
    .filter((person) => person.items.length > 0)
    .sort((left, right) => left.personName.localeCompare(right.personName, 'es'))
}

export function hasQuickNoteEntries(state: QuickNoteState): boolean {
  return createQuickNoteSummary(state).length > 0 || state.customConsumptions.length > 0
}
