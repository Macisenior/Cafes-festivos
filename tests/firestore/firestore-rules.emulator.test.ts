import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const describeWithEmulator = emulatorAvailable ? describe : describe.skip
const rulesPath = fileURLToPath(new URL('../../firestore.rules', import.meta.url))
let environment: RulesTestEnvironment

const v4Group = { id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [] }
const v4Person = { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true }
const v4Contribution = { id: 'cash-1', groupId: 'general', personId: 'pepe', amountInCents: 100, date: '2026-08-10', source: 'user' }
const v4Expense = {
  id: 'expense-1', groupId: 'general', date: '2026-08-10', siteName: 'Flap', concept: 'Café', totalInCents: 100,
  participantIds: ['pepe'], distribution: { mode: 'igual' }, allocations: [{ personId: 'pepe', amountInCents: 100 }],
}

describeWithEmulator('reglas Firestore V3/V4', () => {
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'gastos-del-grupo-v4-rules-test',
      firestore: { rules: readFileSync(rulesPath, 'utf8') },
    })
  })

  afterEach(async () => environment.clearFirestore())
  afterAll(async () => environment.cleanup())

  it('mantiene V3 disponible para un usuario autenticado, como las reglas publicadas actuales', async () => {
    const firestore = environment.authenticatedContext('legacy-user').firestore()
    const reference = doc(firestore, 'grupos', 'general')
    await assertSucceeds(setDoc(reference, { nombreVisible: 'Grupo V3' }))
    await assertSucceeds(getDoc(reference))
  })

  it('mantiene gastos/grupo disponible para un usuario V3 autenticado', async () => {
    const firestore = environment.authenticatedContext('legacy-user').firestore()
    const reference = doc(firestore, 'gastos', 'grupo')
    await assertSucceeds(setDoc(reference, { personas: [], aportaciones: [], gastos: [], pin: 'legacy-pin' }))
    await assertSucceeds(getDoc(reference))
  })

  it('bloquea gastos/grupo para clientes V3 sin autenticar', async () => {
    const firestore = environment.unauthenticatedContext().firestore()
    const reference = doc(firestore, 'gastos', 'grupo')
    await assertFails(getDoc(reference))
    await assertFails(setDoc(reference, { personas: [] }))
  })
  it('bloquea V3 para clientes sin autenticar', async () => {
    const firestore = environment.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(firestore, 'grupos', 'general')))
    await assertFails(setDoc(doc(firestore, 'grupos', 'general'), { nombreVisible: 'No permitido' }))
  })

  it('permite lecturas V4 autenticadas, incluidas las sesiones anónimas actuales', async () => {
    const firestore = environment.authenticatedContext('anonymous-session', { firebase: { sign_in_provider: 'anonymous' } }).firestore()
    await assertSucceeds(getDoc(doc(firestore, 'grupos_v4', 'general')))
    await assertSucceeds(getDoc(doc(firestore, 'grupos_v4', 'general', 'personas', 'pepe')))
    await assertSucceeds(getDoc(doc(firestore, 'grupos_v4', 'general', 'aportaciones', 'cash-1')))
    await assertSucceeds(getDoc(doc(firestore, 'grupos_v4', 'general', 'gastos', 'expense-1')))
  })

  it('bloquea lecturas V4 sin autenticación', async () => {
    const firestore = environment.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(firestore, 'grupos_v4', 'general')))
  })

  it('no abre aportaciones ni gastos financieros V4 a clientes anónimos', async () => {
    const firestore = environment.authenticatedContext('anonymous-session', { firebase: { sign_in_provider: 'anonymous' } }).firestore()
    await assertFails(setDoc(doc(firestore, 'grupos_v4', 'general', 'aportaciones', 'cash-1'), v4Contribution))
    await assertFails(setDoc(doc(firestore, 'grupos_v4', 'general', 'gastos', 'expense-1'), v4Expense))
  })

  it('bloquea operaciones administrativas, borrados y restauración V4 desde el cliente', async () => {
    const firestore = environment.authenticatedContext('anonymous-session', { firebase: { sign_in_provider: 'anonymous' } }).firestore()
    await assertFails(setDoc(doc(firestore, 'grupos_v4', 'nuevo'), { ...v4Group, id: 'nuevo' }))
    await assertFails(setDoc(doc(firestore, 'grupos_v4', 'general', 'personas', 'pepe'), v4Person))
    await assertFails(deleteDoc(doc(firestore, 'grupos_v4', 'general', 'gastos', 'expense-1')))
  })

  it('separa la política V4 de V3 sin alterar la compatibilidad histórica de V3', async () => {
    const firestore = environment.authenticatedContext('legacy-user').firestore()
    await assertSucceeds(setDoc(doc(firestore, 'grupos', 'v3-legacy'), { legacy: true }))
    await assertFails(setDoc(doc(firestore, 'grupos_v4', 'general', 'aportaciones', 'cash-1'), v4Contribution))
    expect(v4Contribution.groupId).toBe('general')
  })
})
