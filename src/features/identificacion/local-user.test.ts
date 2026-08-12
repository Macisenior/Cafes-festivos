import { describe, expect, it } from 'vitest'
import type { Person } from '../../domain/entities'
import {
  SELECTED_PERSON_STORAGE_KEY,
  getActivePeople,
  greetingForHour,
  restoreSelectedPersonId,
  saveSelectedPersonId,
  type LocalStoragePort,
} from './local-user'

class MemoryStorage implements LocalStoragePort {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true },
  { id: 'bea', groupId: 'general', name: 'Bea', phone: '', isActive: false },
]

describe('identificación local', () => {
  it('solicita selección cuando no existe un usuario guardado', () => {
    const storage = new MemoryStorage()
    expect(restoreSelectedPersonId(storage, getActivePeople(people, 'general'), 'general')).toBeNull()
  })

  it('recupera únicamente un identificador que sigue activo', () => {
    const storage = new MemoryStorage()
    saveSelectedPersonId(storage, 'general', 'ana')

    expect(restoreSelectedPersonId(storage, getActivePeople(people, 'general'), 'general')).toBe('ana')
    expect(storage.getItem(`${SELECTED_PERSON_STORAGE_KEY}:general`)).toBe('ana')
  })

  it('descarta una identificación que ya no corresponde a una persona activa', () => {
    const storage = new MemoryStorage()
    saveSelectedPersonId(storage, 'general', 'bea')

    expect(restoreSelectedPersonId(storage, getActivePeople(people, 'general'), 'general')).toBeNull()
    expect(storage.getItem(`${SELECTED_PERSON_STORAGE_KEY}:general`)).toBeNull()
  })

  it('descarta una identificación de una persona que ya no existe', () => {
    const storage = new MemoryStorage()
    saveSelectedPersonId(storage, 'general', 'persona-eliminada')

    expect(restoreSelectedPersonId(storage, getActivePeople(people, 'general'), 'general')).toBeNull()
    expect(storage.getItem(`${SELECTED_PERSON_STORAGE_KEY}:general`)).toBeNull()
  })

  it('aísla la identificación local entre grupos', () => {
    const storage = new MemoryStorage()
    saveSelectedPersonId(storage, 'general', 'ana')
    const otherGroupPeople: readonly Person[] = [
      { id: 'ana', groupId: 'viernes-oficial', name: 'Ana', phone: '', isActive: true },
    ]

    expect(
      restoreSelectedPersonId(storage, getActivePeople(otherGroupPeople, 'viernes-oficial'), 'viernes-oficial'),
    ).toBeNull()
    expect(restoreSelectedPersonId(storage, getActivePeople(people, 'general'), 'general')).toBe('ana')
  })

  it('solicita una identificación nueva al cambiar a un grupo sin usuario local guardado', () => {
    const storage = new MemoryStorage()
    saveSelectedPersonId(storage, 'general', 'ana')
    const otherGroupPeople: readonly Person[] = [
      { id: 'carlos', groupId: 'torreznos', name: 'Carlos', phone: '', isActive: true },
    ]

    expect(
      restoreSelectedPersonId(storage, getActivePeople(otherGroupPeople, 'torreznos'), 'torreznos'),
    ).toBeNull()
  })
  it('elige el saludo según la hora local', () => {
    expect(greetingForHour(8)).toBe('Buenos días')
    expect(greetingForHour(16)).toBe('Buenas tardes')
    expect(greetingForHour(22)).toBe('Buenas noches')
  })
})
