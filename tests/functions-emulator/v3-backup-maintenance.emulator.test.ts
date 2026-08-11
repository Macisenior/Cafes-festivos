import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, type Firestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions'
import { V4_FUNCTIONS_REGION } from '../../src/config/firebase-functions'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

const available = Boolean(process.env.FIREBASE_EMULATOR_HUB)
const describeWithEmulator = available ? describe : describe.skip
const projectId = 'demo-no-project'
const administrationPin = 'local-administration-test-pin'
let app: FirebaseApp
let auth: Auth
let firestore: Firestore
let functions: Functions
let rules: RulesTestEnvironment

const backupJson = JSON.stringify({
  fecha: '2026-08-11T13:10:19.198Z',
  personas: [{ id: 1, nombre: 'Pepe', aportado: 10, telefono: '' }],
  aportaciones: [{ personaId: 1, amount: 5, date: '2026-08-10' }],
  gastos: [{ id: 2, participantes: [1], sitio: 'Flap', descripcion: 'Café', fecha: '11/8/2026', monto: 2 }],
})

describeWithEmulator('mantenimiento V3 backup → V4 con Emulator', () => {
  beforeAll(async () => {
    rules = await initializeTestEnvironment({ projectId })
    app = initializeApp({ apiKey: 'test', authDomain: 'test.local', projectId }, 'maintenance-functions-emulator-test')
    auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, { disableWarnings: true })
    functions = getFunctions(app, V4_FUNCTIONS_REGION)
    const [host, port] = (process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001').split(':')
    connectFunctionsEmulator(functions, host, Number(port))
    firestore = getFirestore(app)
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    await signInAnonymously(auth)
    await rules.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore()
      await setDoc(doc(database, 'grupos_v4', 'maintenance-test'), { id: 'maintenance-test', name: 'Mantenimiento', isMainGroup: false, siteOptions: [{ id: 'flap', name: 'Flap' }] })
      await setDoc(doc(database, 'grupos_v4', 'maintenance-test', 'personas', 'old'), { id: 'old', groupId: 'maintenance-test', name: 'Anterior', phone: '', isActive: true })
    })
  })

  afterAll(async () => { await rules.cleanup(); await deleteApp(app) })

  it('previsualiza, guarda copia previa y reemplaza exclusivamente el grupo confirmado', async () => {
    const previewCommand = httpsCallable(functions, 'previewV3BackupReplacementV4')
    const request = {
      pin: administrationPin,
      targetGroupId: 'maintenance-test',
      sourceGroupId: 'maintenance-test',
      backupJson,
      expected: { peopleCount: 1, contributionsCount: 2, expensesCount: 1, contributedInCents: 1000, spentInCents: 200, availableInCents: 800 },
    }
    const preview = await previewCommand(request)
    expect(preview.data).toMatchObject({ after: request.expected, openingContributionsCount: 1 })

    const replace = httpsCallable(functions, 'replaceV3BackupGroupV4')
    await replace({ ...request, confirmationFingerprint: (preview.data as { fingerprint: string }).fingerprint })
    expect((await getDoc(doc(firestore, 'grupos_v4', 'maintenance-test', 'personas', '1'))).data()).toMatchObject({ name: 'Pepe' })
    expect((await getDoc(doc(firestore, 'grupos_v4', 'maintenance-test', 'personas', 'old'))).exists()).toBe(false)

    await rules.withSecurityRulesDisabled(async (context) => {
      const snapshots = await context.firestore().collection('grupos_v4_maintenance_backups').get()
      expect(snapshots.docs.some((snapshot) => snapshot.data().targetGroupId === 'maintenance-test')).toBe(true)
    })
  })

  it('rechaza un objetivo equivocado y JSON inválido sin modificar el grupo', async () => {
    const preview = httpsCallable(functions, 'previewV3BackupReplacementV4')
    await expect(preview({ pin: administrationPin, targetGroupId: 'maintenance-test', sourceGroupId: 'otro', backupJson }))
      .rejects.toMatchObject({ code: 'functions/invalid-argument' })
    await expect(preview({ pin: administrationPin, targetGroupId: 'maintenance-test', sourceGroupId: 'maintenance-test', backupJson: '{' }))
      .rejects.toMatchObject({ code: 'functions/invalid-argument' })
    expect((await getDoc(doc(firestore, 'grupos_v4', 'maintenance-test', 'personas', '1'))).exists()).toBe(true)
  })
})
