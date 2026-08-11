import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions'
import { V4_FUNCTIONS_REGION } from '../../config/firebase-functions'
import { getFirebaseApp } from '../firebase/firebase-client'

export type AdministrationAction =
  | 'createPerson' | 'editPerson' | 'deactivatePerson' | 'reactivatePerson' | 'deletePerson'
  | 'createGroup' | 'editGroupName' | 'deleteEmptyGroup'
  | 'editExpense' | 'deleteExpense'
  | 'editContribution' | 'deleteContribution'

let emulatorConnected = false

function administrationFunctions(): Functions {
  const functions = getFunctions(getFirebaseApp(), V4_FUNCTIONS_REGION)
  if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true' && !emulatorConnected) {
    connectFunctionsEmulator(
      functions,
      import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1',
      Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT ?? '5001'),
    )
    emulatorConnected = true
  }
  return functions
}

/** Cliente sin lógica de negocio: la autorización y las reglas viven en la Function. */
export class FirestoreV4AdministrationFunctionsClient {
  async verifyAdministrationPin(pin: string): Promise<void> {
    await httpsCallable<{ pin: string }, { verified: boolean }>(administrationFunctions(), 'verifyAdministrationPin')({ pin })
  }

  async execute<T>(pin: string, action: AdministrationAction, groupId: string, payload: Record<string, unknown>): Promise<T> {
    const result = await httpsCallable<
      { pin: string; action: AdministrationAction; groupId: string; payload: Record<string, unknown> },
      T
    >(administrationFunctions(), 'administrationV4')({ pin, action, groupId, payload })
    return result.data
  }
}
