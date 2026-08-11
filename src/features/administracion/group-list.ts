import type { Group, GroupId } from '../../domain/entities'

export interface AdministrationGroupListItem {
  id: GroupId
  name: string
  isMainGroup: boolean
  isActiveGroup: boolean
}

/** Consulta administrativa sobre los grupos V4 ya disponibles en el contenedor. */
export function createAdministrationGroupList(
  groups: readonly Group[],
  activeGroupId: GroupId,
): readonly AdministrationGroupListItem[] {
  return groups
    .map((group) => ({
      id: group.id,
      name: group.name,
      isMainGroup: group.isMainGroup,
      isActiveGroup: group.id === activeGroupId,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es') || left.id.localeCompare(right.id))
}
