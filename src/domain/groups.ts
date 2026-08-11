import type { Group, GroupId } from './entities'
import type { GroupFinancialEntities } from './financial-adapter'

export class GroupDomainError extends Error {}

export interface NewStandardGroupInput {
  id: GroupId
  name: string
}

function assertGroupId(id: string): void {
  if (id.trim().length === 0 || id.includes('/')) {
    throw new GroupDomainError('El grupo necesita un identificador estable válido.')
  }
}

function assertGroupName(name: string): void {
  if (name.trim().length === 0) {
    throw new GroupDomainError('El nombre visible del grupo es obligatorio.')
  }
}

function normalizedGroupName(name: string): string {
  return name.trim().toLocaleLowerCase('es-ES')
}

/** Crea un grupo estándar vacío, sin personas ni movimientos financieros asociados. */
export function createStandardGroup(groups: readonly Group[], input: NewStandardGroupInput): Group {
  assertGroupId(input.id)
  assertGroupName(input.name)

  if (groups.some((group) => group.id === input.id)) {
    throw new GroupDomainError('Ya existe un grupo con ese identificador.')
  }

  if (groups.some((group) => normalizedGroupName(group.name) === normalizedGroupName(input.name))) {
    throw new GroupDomainError('Ya existe un grupo con ese nombre visible.')
  }

  return {
    id: input.id,
    name: input.name.trim(),
    isMainGroup: false,
    siteOptions: [],
  }
}

/** Edita únicamente el nombre visible y conserva identificador, tipo y configuración del grupo. */
export function editGroupName(
  groups: readonly Group[],
  groupId: GroupId,
  name: string,
): Group {
  assertGroupId(groupId)
  assertGroupName(name)
  const group = groups.find((candidate) => candidate.id === groupId)

  if (group === undefined) throw new GroupDomainError('El grupo no existe en V4.')

  if (groups.some((candidate) => candidate.id !== groupId && normalizedGroupName(candidate.name) === normalizedGroupName(name))) {
    throw new GroupDomainError('Ya existe un grupo con ese nombre visible.')
  }

  return { ...group, name: name.trim() }
}

export interface GroupDeletionEligibility {
  canDelete: boolean
  reason: string | null
}

/** Comprueba el agregado V4 del grupo; no modifica ni vacía datos para habilitar el borrado. */
export function getGroupDeletionEligibility(
  entities: GroupFinancialEntities,
  activeGroupId: GroupId,
): GroupDeletionEligibility {
  const { group } = entities

  if (group.id === 'general' || group.isMainGroup) {
    return { canDelete: false, reason: 'El grupo principal está protegido contra borrado.' }
  }
  if (group.id === activeGroupId) {
    return { canDelete: false, reason: 'No se puede borrar el grupo activo.' }
  }

  const hasPeople = entities.people.some((person) => person.groupId === group.id)
  const hasContributions = entities.contributions.some((contribution) => contribution.groupId === group.id)
  const hasExpenses = entities.expenses.some((expense) => expense.groupId === group.id)
  if (hasPeople || hasContributions || hasExpenses) {
    return { canDelete: false, reason: 'El grupo contiene datos o historial que deben conservarse.' }
  }

  return { canDelete: true, reason: null }
}

/** Rechaza el borrado si el grupo no está vacío o si es principal/activo. */
export function assertGroupCanBeDeleted(
  entities: GroupFinancialEntities,
  activeGroupId: GroupId,
): void {
  const eligibility = getGroupDeletionEligibility(entities, activeGroupId)
  if (!eligibility.canDelete) throw new GroupDomainError(eligibility.reason ?? 'El grupo no se puede borrar.')
}
