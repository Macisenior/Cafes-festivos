import { describe, expect, it } from 'vitest'
import { createV4Backup, parseV4Backup, summarizeV4Backup } from './v4-backup'

const entities = { group: { id: 'general', name: 'General', isMainGroup: true, siteOptions: [] }, people: [{ id: 'ana', groupId: 'general', name: 'Ana', phone: '', isActive: true }], contributions: [{ id: 'c1', groupId: 'general', personId: 'ana', date: null, amountInCents: 100, source: 'v3-opening' as const }], expenses: [{ id: 'e1', groupId: 'general', date: '2026-08-10', siteName: 'Flap', concept: 'Café', totalInCents: 100, participantIds: ['ana'], distribution: { mode: 'igual' as const }, allocations: [{ personId: 'ana', amountInCents: 100 }] }] }

describe('copia de seguridad V4', () => {
  it('serializa todos los datos V4 y produce un resumen sin saldos acumulados', () => {
    const backup = createV4Backup([entities], '2026-08-10T10:00:00.000Z')
    expect(summarizeV4Backup(backup)).toEqual({ groups: 1, people: 1, contributions: 1, expenses: 1 })
    expect(parseV4Backup(JSON.stringify(backup))).toEqual(backup)
  })

  it('rechaza formato, versión y estructura ajenos a V4 antes de restaurar', () => {
    expect(() => parseV4Backup('{}')).toThrow()
    expect(() => parseV4Backup(JSON.stringify({ format: 'v3', version: 1, generatedAt: 'x', groups: [] }))).toThrow()
    expect(() => parseV4Backup(JSON.stringify({ format: 'gastos-del-grupo-v4-backup', version: 1, generatedAt: 'x', groups: [{ group: { id: 'general' } }] }))).toThrow()
  })
})
