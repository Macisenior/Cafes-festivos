import type { Person } from '../../domain/entities'

export const SELECTED_PERSON_STORAGE_KEY = 'gastos-del-grupo-v4:selected-person-id'

export interface LocalStoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Devuelve solo las personas que actualmente pueden identificarse en el grupo. */
export function getActivePeople(people: readonly Person[], groupId: string): readonly Person[] {
  return people.filter((person) => person.groupId === groupId && person.isActive)
}

export function selectedPersonStorageKey(groupId: string): string {
  return `${SELECTED_PERSON_STORAGE_KEY}:${groupId}`
}

/** Recupera la identificación local y descarta referencias obsoletas. */
export function restoreSelectedPersonId(
  storage: LocalStoragePort,
  activePeople: readonly Person[],
  groupId: string,
): string | null {
  const storageKey = selectedPersonStorageKey(groupId)
  const personId = storage.getItem(storageKey)

  if (personId === null) return null

  if (!activePeople.some((person) => person.id === personId)) {
    storage.removeItem(storageKey)
    return null
  }

  return personId
}

/** Guarda localmente solo el identificador de la persona seleccionada. */
export function saveSelectedPersonId(storage: LocalStoragePort, groupId: string, personId: string): void {
  storage.setItem(selectedPersonStorageKey(groupId), personId)
}

export function greetingForHour(hour: number): string {
  if (hour >= 6 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 21) return 'Buenas tardes'
  return 'Buenas noches'
}
