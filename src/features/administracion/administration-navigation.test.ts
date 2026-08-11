import { describe, expect, it } from 'vitest'
import { openAdministrationArea, returnToAdministrationMenu } from './administration-navigation'

describe('navegación de Administración', () => {
  it('abre las secciones de Personas y Grupos desde el menú', () => {
    expect(openAdministrationArea('people')).toBe('people')
    expect(openAdministrationArea('groups')).toBe('groups')
  })

  it('vuelve al menú administrativo desde una sección', () => {
    expect(returnToAdministrationMenu()).toBe('menu')
  })

  it('mantiene Gastos como área administrativa separada', () => {
    expect(openAdministrationArea('expenses')).toBe('expenses')
  })

  it('abre Históricos como área administrativa separada', () => {
    expect(openAdministrationArea('history')).toBe('history')
  })

  it('abre Informes y Gastos por persona como áreas administrativas', () => {
    expect(openAdministrationArea('reports')).toBe('reports')
    expect(openAdministrationArea('expenses-by-person')).toBe('expenses-by-person')
    expect(openAdministrationArea('contributions-by-person')).toBe('contributions-by-person')
    expect(openAdministrationArea('global-wallet')).toBe('global-wallet')
    expect(openAdministrationArea('account-state-at-date')).toBe('account-state-at-date')
    expect(openAdministrationArea('pro-summary')).toBe('pro-summary')
  })
})
