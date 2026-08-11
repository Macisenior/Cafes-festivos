import { describe, expect, it } from 'vitest'
import type { Group } from '../../domain/entities'
import { createAdministrationGroupList } from './group-list'

const groups: readonly Group[] = [
  { id: 'viernes', name: 'Viernes Oficial', isMainGroup: false, siteOptions: [] },
  { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] },
]

describe('listado administrativo de grupos', () => {
  it('muestra los grupos V4 con identificador, nombre visible e información básica', () => {
    expect(createAdministrationGroupList(groups, 'general')).toEqual([
      { id: 'general', name: 'Cafés Semanal', isMainGroup: true, isActiveGroup: true },
      { id: 'viernes', name: 'Viernes Oficial', isMainGroup: false, isActiveGroup: false },
    ])
  })

  it('devuelve un estado vacío de datos cuando no hay grupos disponibles', () => {
    expect(createAdministrationGroupList([], 'general')).toEqual([])
  })

  it('identifica el grupo activo sin cambiar ni modificar los grupos', () => {
    const result = createAdministrationGroupList(groups, 'viernes')

    expect(result.find((group) => group.id === 'viernes')?.isActiveGroup).toBe(true)
    expect(result.find((group) => group.id === 'general')?.isActiveGroup).toBe(false)
    expect(groups).toEqual([
      { id: 'viernes', name: 'Viernes Oficial', isMainGroup: false, siteOptions: [] },
      { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] },
    ])
  })
})
