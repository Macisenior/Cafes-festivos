import type { Group } from '../../domain/entities'

interface ActiveGroupSelectorProps {
  activeGroupId: string
  availableGroups: readonly Group[]
  isChanging: boolean
  onChange(groupId: string): void
}

/** Selector reutilizable; el estado y la validación del grupo viven en el contenedor de aplicación. */
export function ActiveGroupSelector({ activeGroupId, availableGroups, isChanging, onChange }: ActiveGroupSelectorProps) {
  return (
    <label className="group-selector">
      Grupo activo
      <select value={activeGroupId} disabled={isChanging} onChange={(event) => onChange(event.target.value)}>
        {availableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
    </label>
  )
}
