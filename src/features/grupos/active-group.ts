import type { GroupId } from '../../domain/entities'
import type { LocalStoragePort } from '../identificacion/local-user'

export const DEFAULT_ACTIVE_GROUP_ID = 'general'
export const ACTIVE_GROUP_STORAGE_KEY = 'gastos-del-grupo-v4:active-group-id'

/** Recupera un grupo existente; cualquier valor obsoleto vuelve de forma segura a general. */
export function restoreActiveGroupId(
  storage: LocalStoragePort,
  availableGroupIds: readonly GroupId[],
): GroupId {
  const storedGroupId = storage.getItem(ACTIVE_GROUP_STORAGE_KEY)

  if (storedGroupId !== null && availableGroupIds.includes(storedGroupId)) {
    return storedGroupId
  }

  if (storedGroupId !== null) {
    storage.removeItem(ACTIVE_GROUP_STORAGE_KEY)
  }

  return DEFAULT_ACTIVE_GROUP_ID
}

/** Guarda únicamente el identificador del grupo activo de este dispositivo. */
export function saveActiveGroupId(storage: LocalStoragePort, groupId: GroupId): void {
  storage.setItem(ACTIVE_GROUP_STORAGE_KEY, groupId)
}
