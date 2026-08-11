import { describe, expect, it } from 'vitest'
import type { LocalStoragePort } from '../identificacion/local-user'
import {
  ACTIVE_GROUP_STORAGE_KEY,
  DEFAULT_ACTIVE_GROUP_ID,
  restoreActiveGroupId,
  saveActiveGroupId,
} from './active-group'

class MemoryStorage implements LocalStoragePort {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

describe('grupo activo local', () => {
  it('usa general por defecto cuando no existe grupo guardado', () => {
    expect(restoreActiveGroupId(new MemoryStorage(), ['general'])).toBe(DEFAULT_ACTIVE_GROUP_ID)
  })

  it('guarda y recupera un cambio de grupo válido', () => {
    const storage = new MemoryStorage()
    saveActiveGroupId(storage, 'viernes-oficial')

    expect(restoreActiveGroupId(storage, ['general', 'viernes-oficial'])).toBe('viernes-oficial')
  })

  it('descarta un grupo guardado que ya no existe y vuelve a general', () => {
    const storage = new MemoryStorage()
    saveActiveGroupId(storage, 'grupo-eliminado')

    expect(restoreActiveGroupId(storage, ['general'])).toBe('general')
    expect(storage.getItem(ACTIVE_GROUP_STORAGE_KEY)).toBeNull()
  })
})
