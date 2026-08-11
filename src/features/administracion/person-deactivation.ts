import type { GroupId, Person } from '../../domain/entities'

/** Decide únicamente la disponibilidad de la acción; la baja real sigue viviendo en el servicio de personas. */
export function canDeactivatePerson(groupId: GroupId, person: Person): boolean {
  return person.groupId === groupId && person.isActive
}

export function canReactivatePerson(groupId: GroupId, person: Person): boolean {
  return person.groupId === groupId && !person.isActive
}

export function deactivationConfirmationText(person: Person): string {
  return `Vas a inactivar a ${person.name}. Sus aportaciones, gastos y repartos históricos se conservarán sin cambios.`
}

export function reactivationConfirmationText(person: Person): string {
  return `Vas a reactivar a ${person.name}. Sus movimientos históricos se conservarán sin cambios.`
}
