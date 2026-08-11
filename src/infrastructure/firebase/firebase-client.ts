import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const FIREBASE_APP_NAME = 'gastos-del-grupo-v4'

/** Obtiene la configuración pública de Firebase suministrada por Vite. */
export function readFirebaseOptionsFromEnvironment(
  environment: Record<string, string | undefined> = import.meta.env,
): FirebaseOptions {
  const { VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID } = environment

  if (!VITE_FIREBASE_API_KEY || !VITE_FIREBASE_AUTH_DOMAIN || !VITE_FIREBASE_PROJECT_ID) {
    throw new Error('Falta la configuración pública de Firebase para V4.')
  }

  return {
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    appId: environment.VITE_FIREBASE_APP_ID,
    storageBucket: environment.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
  }
}

/**
 * Inicializa el cliente Firebase y autentica anónimamente para lecturas, como
 * hacía V3. No ejecuta ninguna operación de escritura en Firestore.
 */
/** Devuelve la única aplicación Firebase V4 ya inicializada para Firestore y Functions. */
export function getFirebaseApp(options = readFirebaseOptionsFromEnvironment()): FirebaseApp {
  return getApps().some((candidate) => candidate.name === FIREBASE_APP_NAME)
    ? getApp(FIREBASE_APP_NAME)
    : initializeApp(options, FIREBASE_APP_NAME)
}
export async function connectFirebaseForReadOnly(options = readFirebaseOptionsFromEnvironment()): Promise<Firestore> {
  const app = getFirebaseApp(options)
  const auth = getAuth(app)

  if (!auth.currentUser) {
    await signInAnonymously(auth)
  }

  return getFirestore(app)
}
