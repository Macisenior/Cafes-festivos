import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions'
import { V4_FUNCTIONS_REGION } from '../../src/config/firebase-functions'
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

const available = Boolean(process.env.FIREBASE_EMULATOR_HUB)
const describeWithEmulator = available ? describe : describe.skip
let app: FirebaseApp
let auth: Auth
let functions: Functions
let firestore: Firestore
let rules: RulesTestEnvironment

const projectId = 'demo-no-project'
const operationalPin = 'local-operational-test-pin'

function hostPort(variable: 'FIREBASE_AUTH_EMULATOR_HOST' | 'FIREBASE_FUNCTIONS_EMULATOR_HOST', fallback: string): [string, number] {
  const [host, rawPort] = (process.env[variable] ?? fallback).split(':')
  return [host, Number(rawPort)]
}

async function seedGroup(): Promise<void> {
  await rules.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore()
    await setDoc(doc(database, 'grupos_v4', 'general'), {
      id: 'general', name: 'Cafés Semanal', isMainGroup: true, siteOptions: [{ id: 'flap', name: 'Flap' }],
    })
    await setDoc(doc(database, 'grupos_v4', 'general', 'personas', 'pepe'), {
      id: 'pepe', groupId: 'general', name: 'Pepe', phone: '', isActive: true,
    })
  })
}

describeWithEmulator('Functions operativas V4 con Emulator', () => {
  beforeAll(async () => {
    rules = await initializeTestEnvironment({ projectId })
    app = initializeApp({ apiKey: 'test', authDomain: 'test.local', projectId }, 'functions-emulator-test')
    auth = getAuth(app)
    const [authHost, authPort] = hostPort('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099')
    const [functionsHost, functionsPort] = hostPort('FIREBASE_FUNCTIONS_EMULATOR_HOST', '127.0.0.1:5001')
    connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true })
    functions = getFunctions(app, V4_FUNCTIONS_REGION)
    connectFunctionsEmulator(functions, functionsHost, functionsPort)
    await signInAnonymously(auth)
    firestore = getFirestore(app)
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    await seedGroup()
  })

  afterAll(async () => {
    await rules.cleanup()
    await deleteApp(app)
  })

  it('acepta PIN correcto y crea una aportación mediante Function', async () => {
    const command = httpsCallable(functions, 'createContributionV4')
    const result = await command({
      pin: operationalPin,
      input: { id: 'cash-function-1', groupId: 'general', personId: 'pepe', amountInCents: 100, date: '2026-08-10' },
    })

    expect(result.data).toMatchObject({ id: 'cash-function-1', amountInCents: 100, source: 'user' })
    expect((await getDoc(doc(firestore, 'grupos_v4', 'general', 'aportaciones', 'cash-function-1'))).data()).toMatchObject({ amountInCents: 100 })
  })

  it('rechaza PIN incorrecto sin crear una aportación', async () => {
    const command = httpsCallable(functions, 'createContributionV4')
    await expect(command({
      pin: 'incorrecto',
      input: { id: 'cash-function-pin-fail', groupId: 'general', personId: 'pepe', amountInCents: 100, date: '2026-08-10' },
    })).rejects.toMatchObject({ code: 'functions/permission-denied' })
    expect((await getDoc(doc(firestore, 'grupos_v4', 'general', 'aportaciones', 'cash-function-pin-fail'))).exists()).toBe(false)
  })

  it('propaga la validación de dominio de una aportación inválida', async () => {
    const command = httpsCallable(functions, 'createContributionV4')
    await expect(command({
      pin: operationalPin,
      input: { id: 'cash-function-invalid', groupId: 'general', personId: 'pepe', amountInCents: 0, date: '2026-08-10' },
    })).rejects.toMatchObject({ code: 'functions/invalid-argument' })
  })

  it('crea gasto y asignaciones desde el dominio V4', async () => {
    const command = httpsCallable(functions, 'createExpenseV4')
    const result = await command({
      pin: operationalPin,
      input: {
        id: 'expense-function-1', groupId: 'general', date: '2026-08-10', siteName: 'Flap', concept: 'Cafés',
        totalInCents: 101, participantIds: ['pepe'], distribution: { mode: 'igual' },
      },
    })
    expect(result.data).toMatchObject({ id: 'expense-function-1', allocations: [{ personId: 'pepe', amountInCents: 101 }] })
  })

  it('mantiene V4 cerrada a escritura directa y V3 con su permiso autenticado heredado', async () => {
    await expect(setDoc(doc(firestore, 'grupos_v4', 'general', 'aportaciones', 'direct-fail'), {
      id: 'direct-fail', groupId: 'general', personId: 'pepe', amountInCents: 100, date: '2026-08-10', source: 'user',
    })).rejects.toMatchObject({ code: 'permission-denied' })

    await expect(setDoc(doc(firestore, 'grupos', 'legacy-unchanged'), { preserved: true })).resolves.toBeUndefined()
  })
})
