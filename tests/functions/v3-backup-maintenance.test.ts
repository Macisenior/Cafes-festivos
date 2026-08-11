import { describe, expect, it } from 'vitest'
import type { GroupFinancialEntities } from '../../src/domain/financial-adapter'
import {
  previewV3BackupReplacement,
  replaceV3BackupGroup,
  type MaintenanceBackup,
  type V3BackupReplacementPort,
} from '../../functions/src/v3-backup-maintenance'

const current: GroupFinancialEntities = {
  group: { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [{ id: 'flap', name: 'Flap' }] },
  people: [{ id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true }],
  contributions: [{ id: 'old', groupId: 'general', personId: 'pepe', date: '2026-01-01', amountInCents: 100, source: 'user' }],
  expenses: [],
}

const backupJson = JSON.stringify({
  fecha: '2026-08-11T13:10:19.198Z',
  personas: [{ id: 1, nombre: 'Pepe', aportado: 10, telefono: '' }],
  aportaciones: [{ personaId: 1, amount: 5, date: '2026-08-10' }],
  gastos: [{ id: 2, participantes: [1], sitio: 'Flap', descripcion: 'Café', fecha: '11/8/2026', monto: 2 }],
})

function request(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    targetGroupId: 'general', sourceGroupId: 'general', backupJson,
    expected: { peopleCount: 1, contributionsCount: 2, expensesCount: 1, contributedInCents: 1000, spentInCents: 200, availableInCents: 800 },
    ...overrides,
  }
}

function createPort(failFirstReplacement = false) {
  let state = current
  const backups: MaintenanceBackup[] = []
  let replacements = 0
  const port: V3BackupReplacementPort = {
    readGroup: async () => state,
    saveMaintenanceBackup: async (backup) => { backups.push(backup) },
    replaceGroup: async (_groupId, entities) => {
      replacements += 1
      if (failFirstReplacement && replacements === 1) {
        state = { ...entities, contributions: [] }
        throw new Error('Fallo simulado a mitad del reemplazo.')
      }
      state = entities
    },
  }
  return { port, backups, state: () => state }
}

describe('recreación controlada V4 desde copia JSON V3', () => {
  it('prepara una vista previa exacta, incluyendo Inicio e ID determinista para aportación sin ID', async () => {
    const { port } = createPort()
    const preview = await previewV3BackupReplacement(request(), port)
    expect(preview.after).toEqual({ peopleCount: 1, contributionsCount: 2, expensesCount: 1, contributedInCents: 1000, spentInCents: 200, availableInCents: 800 })
    expect(preview.openingContributionsCount).toBe(1)
    expect(preview.fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rechaza JSON inválido y grupo fuente distinto antes de guardar una copia', async () => {
    const { port, backups } = createPort()
    await expect(previewV3BackupReplacement(request({ backupJson: '{' }), port)).rejects.toThrow('JSON')
    await expect(previewV3BackupReplacement(request({ sourceGroupId: 'Torreznos' }), port)).rejects.toThrow('no coincide')
    expect(backups).toEqual([])
  })

  it('guarda copia V4 previa y termina con la relectura íntegra exacta', async () => {
    const { port, backups, state } = createPort()
    const preview = await previewV3BackupReplacement(request(), port)
    const result = await replaceV3BackupGroup({ ...request(), confirmationFingerprint: preview.fingerprint }, port)
    expect(backups).toHaveLength(1)
    expect(backups[0].entities).toEqual(current)
    expect(result.after.availableInCents).toBe(800)
    expect(state().contributions).toHaveLength(2)
  })

  it('revierte al grupo previo cuando falla una fase del reemplazo', async () => {
    const { port, backups, state } = createPort(true)
    const preview = await previewV3BackupReplacement(request(), port)
    await expect(replaceV3BackupGroup({ ...request(), confirmationFingerprint: preview.fingerprint }, port)).rejects.toThrow('Fallo simulado')
    expect(backups).toHaveLength(1)
    expect(state()).toEqual(current)
  })

  it('rechaza una confirmación que no procede de la vista previa actual', async () => {
    const { port, backups } = createPort()
    await expect(replaceV3BackupGroup({ ...request(), confirmationFingerprint: 'otra-vista-previa' }, port)).rejects.toThrow('confirmación')
    expect(backups).toEqual([])
  })
})

