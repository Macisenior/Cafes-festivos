import { accessPinConfig, type ProtectedArea } from '../../config/access-pin-config'

export type AppScreen = 'information' | ProtectedArea
export interface AccessSessions { operational: boolean; administration: boolean }
export const initialAccessSessions: AccessSessions = { operational: false, administration: false }

/** Pantalla pública y dos sesiones locales, sin persistencia ni acceso a datos financieros. */
export function canAccessScreen(screen: AppScreen, sessions: AccessSessions): boolean { return screen === 'information' || sessions[screen] }
export function isPinConfigured(area: ProtectedArea, config = accessPinConfig): boolean { return config[area].length > 0 }
export function isPinValidWithConfig(area: ProtectedArea, pin: string, config: Readonly<Record<ProtectedArea, string>>): boolean { return isPinConfigured(area, config) && pin === config[area] }
export function isPinValid(area: ProtectedArea, pin: string): boolean { return isPinValidWithConfig(area, pin, accessPinConfig) }
export function unlockArea(sessions: AccessSessions, area: ProtectedArea): AccessSessions { return { ...sessions, [area]: true } }
export function lockArea(sessions: AccessSessions, area: ProtectedArea): AccessSessions { return { ...sessions, [area]: false } }