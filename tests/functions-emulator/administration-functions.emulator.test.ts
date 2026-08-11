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

describeWithEmulator('Functions administrativas V4 con Emulator', () => {
  beforeAll(async () => {
    rules = await initializeTestEnvironment({ projectId })
    app = initializeApp({ apiKey: 'test', authDomain: 'test.local', projectId }, 'administration-functions-emulator-test')
    auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, { disableWarnings: true })
    functions = getFunctions(app, V4_FUNCTIONS_REGION)
    const [host, port] = (process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001').split(':')
    connectFunctionsEmulator(functions, host, Number(port))
    firestore = getFirestore(app)
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
    await signInAnonymously(auth)
    await rules.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'grupos_v4', 'admin-test'), { id: 'admin-test', name: 'Administración', isMainGroup: false, siteOptions: [] })
      await setDoc(doc(db, 'grupos_v4', 'admin-test', 'personas', 'ana'), { id: 'ana', groupId: 'admin-test', name: 'Ana', phone: '', isActive: false })
    })
  })

  afterAll(async () => {
    await rules.cleanup()
    await deleteApp(app)
  })

  it('acepta el PIN administrativo correcto y rechaza el incorrecto', async () => {
    const verify = httpsCallable(functions, 'verifyAdministrationPin')
    await expect(verify({ pin: administrationPin })).resolves.toMatchObject({ data: { verified: true } })
    await expect(verify({ pin: 'incorrecto' })).rejects.toMatchObject({ code: 'functions/permission-denied' })
  })

  it('reactiva una persona mediante Function sin alterar aportaciones o gastos', async () => {
    const command = httpsCallable(functions, 'administrationV4')
    await command({ pin: administrationPin, action: 'reactivatePerson', groupId: 'admin-test', payload: { personId: 'ana' } })
    expect((await getDoc(doc(firestore, 'grupos_v4', 'admin-test', 'personas', 'ana'))).data()).toMatchObject({ isActive: true })
    expect((await getDoc(doc(firestore, 'grupos_v4', 'admin-test', 'aportaciones', 'none'))).exists()).toBe(false)
    expect((await getDoc(doc(firestore, 'grupos_v4', 'admin-test', 'gastos', 'none'))).exists()).toBe(false)
  })
})
