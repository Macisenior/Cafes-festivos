import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { V4_FUNCTIONS_REGION } from '../../src/config/firebase-functions'
import type { Contribution, Expense, Group, Person } from '../../src/domain/entities'
import {
  createCashContributionCommand,
  createExpenseCommand,
  isOperationalDomainError,
  OperationalAuthorizationError,
  type OperationalGroupSnapshot,
  type OperationalWritePort,
} from './operational-commands'

if (getApps().length === 0) initializeApp()

const operationalPin = defineSecret('V4_OPERATIONAL_PIN')
const firestore = getFirestore()

function assertAuthenticated(auth: unknown): void {
  if (auth === null || auth === undefined) {
    throw new HttpsError('unauthenticated', 'Se requiere una sesión Firebase autenticada.')
  }
}

function mapOperationalError(error: unknown): never {
  if (error instanceof HttpsError) throw error
  if (error instanceof OperationalAuthorizationError) {
    throw new HttpsError('permission-denied', 'El PIN operativo no es correcto.')
  }
  if (isOperationalDomainError(error)) {
    throw new HttpsError('invalid-argument', error.message)
  }
  throw new HttpsError('internal', 'No se ha podido completar la operación operativa.')
}

const writes: OperationalWritePort = {
  async readGroup(groupId: string): Promise<OperationalGroupSnapshot> {
    const groupReference = firestore.doc(`grupos_v4/${groupId}`)
    const [groupSnapshot, peopleSnapshot, contributionsSnapshot, expensesSnapshot] = await Promise.all([
      groupReference.get(),
      groupReference.collection('personas').get(),
      groupReference.collection('aportaciones').get(),
      groupReference.collection('gastos').get(),
    ])
    if (!groupSnapshot.exists) throw new HttpsError('not-found', 'No existe el grupo V4 solicitado.')

    return {
      group: groupSnapshot.data() as Group,
      people: peopleSnapshot.docs.map((snapshot) => snapshot.data() as Person),
      contributions: contributionsSnapshot.docs.map((snapshot) => snapshot.data() as Contribution),
      expenses: expensesSnapshot.docs.map((snapshot) => snapshot.data() as Expense),
    }
  },
  async createContribution(contribution: Contribution): Promise<void> {
    await firestore.doc(`grupos_v4/${contribution.groupId}/aportaciones/${contribution.id}`).create(contribution)
  },
  async createExpense(expense: Expense): Promise<void> {
    await firestore.doc(`grupos_v4/${expense.groupId}/gastos/${expense.id}`).create(expense)
  },
}

/** Verifica el PIN para desbloquear la interfaz; no concede ni persiste un rol Firebase. */
export const verifyOperationalPin = onCall({ region: V4_FUNCTIONS_REGION, secrets: [operationalPin] }, async (request) => {
  assertAuthenticated(request.auth)
  try {
    const receivedPin = (request.data as { pin?: unknown } | null)?.pin
    createOperationalPinVerification(receivedPin)
    return { verified: true }
  } catch (error) {
    return mapOperationalError(error)
  }
})

function createOperationalPinVerification(receivedPin: unknown): void {
  // Reutiliza la misma comprobación de servidor que las operaciones de escritura.
  const expectedPin = operationalPin.value()
  if (typeof receivedPin !== 'string' || receivedPin !== expectedPin) {
    throw new OperationalAuthorizationError('El PIN operativo no es válido.')
  }
}

export const createContributionV4 = onCall({ region: V4_FUNCTIONS_REGION, secrets: [operationalPin] }, async (request) => {
  assertAuthenticated(request.auth)
  try {
    return await createCashContributionCommand(request.data, operationalPin.value(), writes)
  } catch (error) {
    return mapOperationalError(error)
  }
})

export const createExpenseV4 = onCall({ region: V4_FUNCTIONS_REGION, secrets: [operationalPin] }, async (request) => {
  assertAuthenticated(request.auth)
  try {
    return await createExpenseCommand(request.data, operationalPin.value(), writes)
  } catch (error) {
    return mapOperationalError(error)
  }
})

export { administrationV4, verifyAdministrationPin } from './administration-functions'

export { previewV3BackupReplacementV4, replaceV3BackupGroupV4 } from './maintenance-functions'
