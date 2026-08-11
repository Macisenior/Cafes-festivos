import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { V4_FUNCTIONS_REGION } from '../../src/config/firebase-functions'
import type { Contribution, Expense, Group, Person } from '../../src/domain/entities'
import type { GroupFinancialEntities } from '../../src/domain/financial-adapter'
import {
  AdministrationAuthorizationError,
  AdministrationRequestError,
  assertAdministrationPin,
  executeAdministrationCommand,
  type AdministrationCommand,
  type AdministrationPort,
} from './administration-commands'

if (getApps().length === 0) initializeApp()

const administrationPin = defineSecret('V4_ADMINISTRATION_PIN')
const firestore = getFirestore()

function assertAuthenticated(auth: unknown): void {
  if (auth === null || auth === undefined) {
    throw new HttpsError('unauthenticated', 'Se requiere una sesión Firebase autenticada.')
  }
}

function mapAdministrationError(error: unknown): never {
  if (error instanceof HttpsError) throw error
  if (error instanceof AdministrationAuthorizationError) {
    throw new HttpsError('permission-denied', 'El PIN de Administración no es correcto.')
  }
  if (error instanceof AdministrationRequestError || error instanceof Error) {
    throw new HttpsError('invalid-argument', error.message)
  }
  throw new HttpsError('internal', 'No se ha podido completar la operación administrativa.')
}

function groupReference(groupId: string) {
  return firestore.doc(`grupos_v4/${groupId}`)
}

const writes: AdministrationPort = {
  async listGroups(): Promise<readonly Group[]> {
    const snapshots = await firestore.collection('grupos_v4').get()
    return snapshots.docs.map((snapshot) => snapshot.data() as Group)
  },
  async readGroup(groupId: string): Promise<GroupFinancialEntities> {
    const reference = groupReference(groupId)
    const [groupSnapshot, peopleSnapshot, contributionsSnapshot, expensesSnapshot] = await Promise.all([
      reference.get(),
      reference.collection('personas').get(),
      reference.collection('aportaciones').get(),
      reference.collection('gastos').get(),
    ])
    if (!groupSnapshot.exists) throw new AdministrationRequestError('No existe el grupo V4 solicitado.')
    return {
      group: groupSnapshot.data() as Group,
      people: peopleSnapshot.docs.map((snapshot) => snapshot.data() as Person),
      contributions: contributionsSnapshot.docs.map((snapshot) => snapshot.data() as Contribution),
      expenses: expensesSnapshot.docs.map((snapshot) => snapshot.data() as Expense),
    }
  },
  async createGroup(group: Group): Promise<void> {
    await groupReference(group.id).create(group)
  },
  async updateGroupName(groupId: string, name: string): Promise<void> {
    await groupReference(groupId).update({ name })
  },
  async deleteGroup(groupId: string): Promise<void> {
    await groupReference(groupId).delete()
  },
  async createPerson(person: Person, contribution?: Contribution): Promise<void> {
    const batch = firestore.batch()
    batch.create(groupReference(person.groupId).collection('personas').doc(person.id), person)
    if (contribution) batch.create(groupReference(contribution.groupId).collection('aportaciones').doc(contribution.id), contribution)
    await batch.commit()
  },
  async updatePerson(person: Person): Promise<void> {
    await groupReference(person.groupId).collection('personas').doc(person.id).update({
      name: person.name,
      phone: person.phone ?? null,
      isActive: person.isActive,
    })
  },
  async deletePerson(groupId: string, personId: string): Promise<void> {
    await groupReference(groupId).collection('personas').doc(personId).delete()
  },
  async updateExpense(expense: Expense): Promise<void> {
    await groupReference(expense.groupId).collection('gastos').doc(expense.id).set(expense)
  },
  async deleteExpense(groupId: string, expenseId: string): Promise<void> {
    await groupReference(groupId).collection('gastos').doc(expenseId).delete()
  },
  async updateContribution(contribution: Contribution): Promise<void> {
    await groupReference(contribution.groupId).collection('aportaciones').doc(contribution.id).update({
      amountInCents: contribution.amountInCents,
      date: contribution.date,
    })
  },
  async deleteContribution(groupId: string, contributionId: string): Promise<void> {
    await groupReference(groupId).collection('aportaciones').doc(contributionId).delete()
  },
}

export const verifyAdministrationPin = onCall({ region: V4_FUNCTIONS_REGION, secrets: [administrationPin] }, async (request) => {
  assertAuthenticated(request.auth)
  try {
    assertAdministrationPin((request.data as { pin?: unknown } | null)?.pin, administrationPin.value())
    return { verified: true }
  } catch (error) {
    return mapAdministrationError(error)
  }
})

export const administrationV4 = onCall({ region: V4_FUNCTIONS_REGION, secrets: [administrationPin] }, async (request) => {
  assertAuthenticated(request.auth)
  try {
    return await executeAdministrationCommand(request.data as AdministrationCommand, administrationPin.value(), writes)
  } catch (error) {
    return mapAdministrationError(error)
  }
})

