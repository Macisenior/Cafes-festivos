import { describe, expect, it } from 'vitest'
import type { Person } from '../../domain/entities'
import { createAdministrationPeopleList } from './people-list'

const people: readonly Person[] = [
  { id: 'ana', groupId: 'general', name: 'Ana', phone: '600000000', isActive: true },
  { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: false },
  { id: 'mariano', groupId: 'otro', name: 'Mariano', phone: '611111111', isActive: true },
]

describe('listado administrativo de personas', () => {
  it('muestra las personas activas e inactivas del grupo activo con sus datos propios', () => {
    expect(createAdministrationPeopleList('general', people)).toEqual([
      { id: 'ana', name: 'Ana', phone: '600000000', isActive: true },
      { id: 'pepe', name: 'Pepe', phone: '', isActive: false },
    ])
  })

  it('muestra un estado vacío de datos cuando el grupo no tiene personas', () => {
    expect(createAdministrationPeopleList('sin-personas', people)).toEqual([])
  })

  it('se actualiza al cambiar de groupId y no mezcla personas de otros grupos', () => {
    expect(createAdministrationPeopleList('otro', people)).toEqual([
      { id: 'mariano', name: 'Mariano', phone: '611111111', isActive: true },
    ])
  })
})
