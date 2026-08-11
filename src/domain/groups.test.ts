import { describe, expect, it } from 'vitest'
import type { Group } from './entities'
import { createStandardGroup, editGroupName, GroupDomainError } from './groups'
import { createAdministrationGroupList } from '../features/administracion/group-list'

const mainGroup: Group = { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] }

describe('dominio de grupos V4', () => {
  it('crea un grupo estándar vacío sin movimientos financieros ni segundo grupo principal', () => {
    const group = createStandardGroup([mainGroup], { id: 'v4-group-uuid', name: ' Viernes ' })

    expect(group).toEqual({ id: 'v4-group-uuid', name: 'Viernes', isMainGroup: false, siteOptions: [] })
    expect(group).not.toHaveProperty('people')
    expect(group).not.toHaveProperty('contributions')
    expect(group).not.toHaveProperty('expenses')
  })

  it('rechaza nombre vacío e identificador duplicado', () => {
    expect(() => createStandardGroup([], { id: 'nuevo', name: '  ' })).toThrow(GroupDomainError)
    expect(() => createStandardGroup([mainGroup], { id: 'general', name: 'Otro' })).toThrow('Ya existe un grupo')
  })

  it('rechaza un nombre visible duplicado de forma exacta, sin mayúsculas o con espacios exteriores', () => {
    const v4Group: Group = { id: 'v4-existente', name: 'V4', isMainGroup: false, siteOptions: [] }

    expect(() => createStandardGroup([v4Group], { id: 'v4-otro-1', name: 'V4' })).toThrow('nombre visible')
    expect(() => createStandardGroup([v4Group], { id: 'v4-otro-2', name: 'v4' })).toThrow('nombre visible')
    expect(() => createStandardGroup([v4Group], { id: 'v4-otro-3', name: ' V4 ' })).toThrow('nombre visible')
  })

  it('permite un nombre visible realmente diferente', () => {
    const v4Group: Group = { id: 'v4-existente', name: 'V4', isMainGroup: false, siteOptions: [] }

    expect(createStandardGroup([v4Group], { id: 'v4-diferente', name: 'V4 nuevo' }))
      .toMatchObject({ id: 'v4-diferente', name: 'V4 nuevo', isMainGroup: false })
  })

  it('edita solo el nombre visible y conserva groupId e isMainGroup', () => {
    const edited = editGroupName([mainGroup], 'general', 'Nuevo nombre')

    expect(edited).toEqual({ id: 'general', name: 'Nuevo nombre', isMainGroup: true, siteOptions: [] })
  })

  it('permite el mismo nombre propio y rechaza duplicados normalizados de otro grupo', () => {
    const otherGroup: Group = { id: 'otro', name: 'V4', isMainGroup: false, siteOptions: [] }

    expect(editGroupName([otherGroup], 'otro', ' V4 ')).toMatchObject({ id: 'otro', name: 'V4' })
    expect(() => editGroupName([mainGroup, otherGroup], 'general', 'V4')).toThrow('nombre visible')
    expect(() => editGroupName([mainGroup, otherGroup], 'general', 'v4')).toThrow('nombre visible')
    expect(() => editGroupName([mainGroup, otherGroup], 'general', ' V4 ')).toThrow('nombre visible')
  })

  it('mantiene el grupo activo anterior al actualizar el listado con el nuevo grupo', () => {
    const created = createStandardGroup([mainGroup], { id: 'nuevo', name: 'Nuevo grupo' })
    const listing = createAdministrationGroupList([mainGroup, created], 'general')

    expect(listing.find((group) => group.id === 'general')?.isActiveGroup).toBe(true)
    expect(listing.find((group) => group.id === 'nuevo')?.isActiveGroup).toBe(false)
  })
})
