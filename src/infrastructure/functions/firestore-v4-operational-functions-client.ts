import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions'
import type { NewContributionInput } from '../../domain/contributions'
import type { Contribution, Expense } from '../../domain/entities'
import type { NewExpenseInput } from '../../domain/expenses'
import { V4_FUNCTIONS_REGION } from '../../config/firebase-functions'
import { getFirebaseApp } from '../firebase/firebase-client'

let emulatorConnected = false

function operationalFunctions(): Functions {
  const functions = getFunctions(getFirebaseApp(), V4_FUNCTIONS_REGION)
  if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true' && !emulatorConnected) {
    const host = import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1'
    const port = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT ?? '5001')
    connectFunctionsEmulator(functions, host, port)
    emulatorConnected = true
  }
  return functions
}

export class FirestoreV4OperationalFunctionsClient {
  async verifyOperationalPin(pin: string): Promise<void> {
    await httpsCallable<{ pin: string }, { verified: boolean }>(operationalFunctions(), 'verifyOperationalPin')({ pin })
  }

  async createCashContribution(pin: string, input: NewContributionInput): Promise<Contribution> {
    const result = await httpsCallable<{ pin: string; input: NewContributionInput }, Contribution>(
      operationalFunctions(),
      'createContributionV4',
    )({ pin, input })
    return result.data
  }

  async createExpense(pin: string, input: NewExpenseInput): Promise<Expense> {
    const result = await httpsCallable<{ pin: string; input: NewExpenseInput }, Expense>(
      operationalFunctions(),
      'createExpenseV4',
    )({ pin, input })
    return result.data
  }
}
