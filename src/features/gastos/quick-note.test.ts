import { describe, expect, it } from 'vitest'
import type { Person } from '../../domain/entities'
import {
  addCustomQuickNoteConsumption,
  changeQuickNoteQuantity,
  createEmptyQuickNote,
  createQuickNoteSummary,
  quickNoteQuantity,
} from './quick-note'

const ana: Person = { id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true }
const inactive: Person = { id: 'luis', groupId: 'general', name: 'Luis', phone: '', isActive: false }
const otherGroup: Person = { id: 'maria', groupId: 'otro', name: 'María', phone: '', isActive: true }

describe('Apunte rápido', () => {
  it('conserva los recuentos independientes al cambiar de consumición', () => {
    let note = createEmptyQuickNote('general')
    note = changeQuickNoteQuantity(note, ana, 'coffee', 1, '2026-10-29T10:00:00.000Z')
    note = changeQuickNoteQuantity(note, ana, 'beer', 1, '2026-10-29T10:01:00.000Z')
    note = changeQuickNoteQuantity(note, ana, 'coffee', 1, '2026-10-29T10:02:00.000Z')

    expect(quickNoteQuantity(note, 'ana', 'coffee')).toBe(2)
    expect(quickNoteQuantity(note, 'ana', 'beer')).toBe(1)
  })

  it('nunca permite cantidades negativas', () => {
    const note = changeQuickNoteQuantity(createEmptyQuickNote('general'), ana, 'juice', -1)
    expect(quickNoteQuantity(note, 'ana', 'juice')).toBe(0)
  })

  it('permite varias consumiciones personalizadas y rechaza nombres repetidos', () => {
    let note = addCustomQuickNoteConsumption(createEmptyQuickNote('general'), 'Agua', 'custom-water')
    note = addCustomQuickNoteConsumption(note, 'Refresco', 'custom-soft-drink')

    expect(note.customConsumptions.map((item) => item.name)).toEqual(['Agua', 'Refresco'])
    expect(() => addCustomQuickNoteConsumption(note, ' agua ', 'custom-other')).toThrow('ya está disponible')
    expect(() => addCustomQuickNoteConsumption(note, 'CAFÉ', 'custom-coffee')).toThrow('ya está disponible')
  })

  it('resume por persona solo las cantidades anotadas', () => {
    let note = addCustomQuickNoteConsumption(createEmptyQuickNote('general'), 'Agua', 'custom-water')
    note = changeQuickNoteQuantity(note, ana, 'coffee', 1)
    note = changeQuickNoteQuantity(note, ana, 'custom-water', 1)
    note = changeQuickNoteQuantity(note, ana, 'custom-water', 1)

    expect(createQuickNoteSummary(note)).toEqual([{
      personId: 'ana',
      personName: 'Ana',
      items: [
        { consumptionId: 'coffee', consumptionName: 'Café', quantity: 1 },
        { consumptionId: 'custom-water', consumptionName: 'Agua', quantity: 2 },
      ],
    }])
  })

  it('rechaza personas inactivas o pertenecientes a otro grupo', () => {
    const note = createEmptyQuickNote('general')
    expect(() => changeQuickNoteQuantity(note, inactive, 'coffee', 1)).toThrow('activa')
    expect(() => changeQuickNoteQuantity(note, otherGroup, 'coffee', 1)).toThrow('grupo')
  })
})
