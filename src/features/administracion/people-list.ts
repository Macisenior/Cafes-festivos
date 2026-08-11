import type { GroupId, Person } from '../../domain/entities'

export interface AdministrationPersonListItem {
  id: string
  name: string
  phone: string
  isActive: boolean
}

/** Consulta administrativa: conserva activas e inactivas y no conoce movimientos financieros. */
export function createAdministrationPeopleList(
  groupId: GroupId,
  people: readonly Person[],
): readonly AdministrationPersonListItem[] {
  return people
    .filter((person) => person.groupId === groupId)
    .map((person) => ({
      id: person.id,
      name: person.name,
      phone: person.phone,
      isActive: person.isActive,
    }))
    .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name, 'es'))
}
