import { describe, expect, it } from 'vitest'
import { addCustomQuickNoteConsumption, changeQuickNoteQuantity, createEmptyQuickNote } from './quick-note'
import type { QuickNoteStoragePort } from './quick-note-storage'
import { clearQuickNote, quickNoteStorageKey, restoreQuickNote, saveQuickNote } from './quick-note-storage'

class MemoryStorage implements QuickNoteStoragePort {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

const ana = { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true } as const

describe('persistencia local de Apunte rápido', () => {
  it('guarda y recupera cantidades y consumiciones personalizadas', () => {
    const storage = new MemoryStorage()
    let note = addCustomQuickNoteConsumption(createEmptyQuickNote('general'), 'Agua', 'custom-water')
    note = changeQuickNoteQuantity(note, ana, 'custom-water', 1)
    saveQuickNote(storage, note)

    expect(restoreQuickNote(storage, 'general')).toEqual(note)
  })

  it('aísla completamente los apuntes por grupo', () => {
    const storage = new MemoryStorage()
    saveQuickNote(storage, changeQuickNoteQuantity(createEmptyQuickNote('general'), ana, 'coffee', 1))

    expect(restoreQuickNote(storage, 'otro')).toEqual(createEmptyQuickNote('otro'))
    expect(quickNoteStorageKey('general')).not.toBe(quickNoteStorageKey('otro'))
  })

  it('descarta datos dañados o de otro grupo sin lanzar errores', () => {
    const storage = new MemoryStorage()
    storage.setItem(quickNoteStorageKey('general'), '{contenido roto')
    expect(restoreQuickNote(storage, 'general')).toEqual(createEmptyQuickNote('general'))

    storage.setItem(quickNoteStorageKey('general'), JSON.stringify({ version: 1, groupId: 'otro' }))
    expect(restoreQuickNote(storage, 'general')).toEqual(createEmptyQuickNote('general'))
  })

  it('borra exclusivamente los apuntes del grupo indicado', () => {
    const storage = new MemoryStorage()
    storage.setItem(quickNoteStorageKey('general'), 'general')
    storage.setItem(quickNoteStorageKey('otro'), 'otro')
    clearQuickNote(storage, 'general')

    expect(storage.getItem(quickNoteStorageKey('general'))).toBeNull()
    expect(storage.getItem(quickNoteStorageKey('otro'))).toBe('otro')
  })
})
