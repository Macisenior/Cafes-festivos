import { describe, expect, it } from 'vitest'
import { createGroupFinancialView } from '../../domain/financial-adapter'
import {
  convertFirestoreV3GroupToV4,
  type FirestoreV3GroupDocument,
} from './v3-group-converter'

const legacyGroup: FirestoreV3GroupDocument = {
  nombreVisible: '☕ Grupo de prueba',
  personas: [
    { id: 1, nombre: 'Ana', telefono: '600000001', aportado: 100 },
    { id: 2, nombre: 'Bea', telefono: '600000002', aportado: 100 },
    { id: 3, nombre: 'Carlos', telefono: '600000003', aportado: 100 },
  ],
  aportaciones: [
    { id: 11, personaId: 1, amount: 100, date: '01/08/2026' },
    { id: 12, personaId: 2, amount: 100, date: '2026-08-01' },
    { id: 13, personaId: 3, amount: 100, date: '01/08/2026' },
  ],
  gastos: [
    {
      id: 21,
      sitio: 'Flap',
      descripcion: 'Igual',
      monto: 10.01,
      participantes: [1, 2, 3],
      modo: 'igual',
      fecha: '02/08/2026',
    },
    {
      id: 22,
      sitio: 'Colono',
      descripcion: 'Consumiciones',
      monto: 60,
      participantes: [1, 2, 3],
      modo: 'consumiciones',
      consumiciones: { 1: 1, 2: 2, 3: 3 },
      fecha: '03/08/2026',
    },
    {
      id: 23,
      sitio: 'Lydo',
      descripcion: 'Individual',
      monto: 12,
      participantes: [1, 2, 3],
      modo: 'importe',
      importesPersona: { 1: 2, 2: 4, 3: 6 },
      fecha: '04/08/2026',
    },
  ],
}

describe('convertFirestoreV3GroupToV4', () => {
  it('convierte IDs, fechas y euros V3 a las entidades V4 en céntimos', () => {
    const entities = convertFirestoreV3GroupToV4('general', legacyGroup)

    expect(entities.group).toMatchObject({ id: 'general', name: '☕ Grupo de prueba', isMainGroup: true })
    expect(entities.people[0]).toMatchObject({ id: '1', groupId: 'general', isActive: true })
    expect(entities.contributions[0]).toEqual({
      id: '11',
      groupId: 'general',
      personId: '1',
      date: '2026-08-01',
      amountInCents: 10000,
    })
    expect(entities.expenses.map((expense) => expense.allocations)).toEqual([
      [
        { personId: '1', amountInCents: 334 },
        { personId: '2', amountInCents: 334 },
        { personId: '3', amountInCents: 333 },
      ],
      [
        { personId: '1', amountInCents: 1000 },
        { personId: '2', amountInCents: 2000 },
        { personId: '3', amountInCents: 3000 },
      ],
      [
        { personId: '1', amountInCents: 200 },
        { personId: '2', amountInCents: 400 },
        { personId: '3', amountInCents: 600 },
      ],
    ])
  })

  it('entrega entidades convertidas al adaptador y obtiene sus balances', () => {
    const view = createGroupFinancialView(convertFirestoreV3GroupToV4('general', legacyGroup))

    expect(view.expenseIntegrity.every((check) => check.isConsistent)).toBe(true)
    expect(view.groupBalance).toEqual({
      groupId: 'general',
      contributedInCents: 30000,
      spentInCents: 8201,
      availableInCents: 21799,
    })
  })

  it('reconstruye una aportación de apertura V3 sin inventar su fecha', () => {
    const entities = convertFirestoreV3GroupToV4('general', {
      personas: [{ id: 1, nombre: 'Ana', aportado: 30 }],
      aportaciones: [{ id: 11, personaId: 1, amount: 20, date: '2026-08-01' }],
      gastos: [],
    })

    expect(entities.contributions).toContainEqual({
      id: 'v3-opening:general:1',
      groupId: 'general',
      personId: '1',
      date: null,
      amountInCents: 1000,
      source: 'v3-opening',
    })
    expect(createGroupFinancialView(entities).groupBalance.contributedInCents).toBe(3000)
  })

  it('infiere consumiciones válidas cuando un gasto histórico no tiene modo', () => {
    const entities = convertFirestoreV3GroupToV4('general', {
      gastos: [
        {
          id: 21,
          monto: 6,
          participantes: [1, 2],
          consumiciones: { 1: 1, 2: 2 },
          fecha: '2026-08-01',
        },
      ],
    })

    expect(entities.expenses[0].distribution).toEqual({
      mode: 'consumiciones',
      consumptionsByPersonId: { 1: 1, 2: 2 },
    })
    expect(entities.expenses[0].allocations).toEqual([
      { personId: '1', amountInCents: 200 },
      { personId: '2', amountInCents: 400 },
    ])
  })

  it('ignora consumiciones residuales cuando el modo histórico es igual', () => {
    const entities = convertFirestoreV3GroupToV4('general', {
      gastos: [
        {
          id: 22,
          monto: 6,
          participantes: [1, 2],
          modo: 'igual',
          consumiciones: { 1: 1, 2: 2 },
          fecha: '2026-08-01',
        },
      ],
    })

    expect(entities.expenses[0].distribution).toEqual({ mode: 'igual' })
    expect(entities.expenses[0].allocations).toEqual([
      { personId: '1', amountInCents: 300 },
      { personId: '2', amountInCents: 300 },
    ])
  })

  it('asigna IDs V4 distintos a aportaciones V3 con el mismo ID', () => {
    const entities = convertFirestoreV3GroupToV4('general', {
      aportaciones: [
        { id: 11, personaId: 1, amount: 10, date: '2026-08-01' },
        { id: 11, personaId: 1, amount: 20, date: '2026-08-02' },
      ],
    })

    expect(entities.contributions.map((contribution) => contribution.id)).toEqual([
      'v3-contribution:11:1',
      '11',
    ])
  })
})
