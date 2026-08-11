import { describe, expect, it } from 'vitest'
import { canAccessScreen, initialAccessSessions, isPinConfigured, isPinValidWithConfig, lockArea, unlockArea } from './pin-access'

const pins = { operational: '1234', administration: '9876' } as const

describe('guard local por PIN', () => {
  it('mantiene Información libre y ambas zonas bloqueadas inicialmente', () => {
    expect(canAccessScreen('information', initialAccessSessions)).toBe(true)
    expect(canAccessScreen('operational', initialAccessSessions)).toBe(false)
    expect(canAccessScreen('administration', initialAccessSessions)).toBe(false)
  })
  it('valida PINes independientes y rechaza PIN incorrecto', () => {
    expect(isPinValidWithConfig('operational', pins.operational, pins)).toBe(true)
    expect(isPinValidWithConfig('administration', pins.administration, pins)).toBe(true)
    expect(isPinValidWithConfig('operational', pins.administration, pins)).toBe(false)
    expect(isPinValidWithConfig('administration', 'incorrecto', pins)).toBe(false)
  })
  it('no permite desbloquear con una configuración vacía', () => {
    expect(isPinConfigured('operational', { operational: '', administration: '9876' })).toBe(false)
    expect(isPinValidWithConfig('operational', '', { operational: '', administration: '9876' })).toBe(false)
  })
  it('permite Administración directa y mantiene bloqueos manuales independientes', () => {
    const adminOnly = unlockArea(initialAccessSessions, 'administration')
    expect(adminOnly).toEqual({ operational: false, administration: true })
    const both = unlockArea(adminOnly, 'operational')
    expect(lockArea(both, 'operational')).toEqual({ operational: false, administration: true })
    expect(lockArea(both, 'administration')).toEqual({ operational: true, administration: false })
  })
})