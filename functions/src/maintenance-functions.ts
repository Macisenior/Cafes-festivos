import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { V4_FUNCTIONS_REGION } from '../../src/config/firebase-functions'
import type { Contribution, Expense, Person } from '../../src/domain/entities'
import type { GroupFinancialEntities } from '../../src/domain/financial-adapter'
import { assertAdministrationPin, AdministrationAuthorizationError, AdministrationRequestError } from './administration-commands'
import {
  previewV3BackupReplacement,
  replaceV3BackupGroup,
  type MaintenanceBackup,
  type V3BackupReplacementConfirmation,
  type V3BackupReplacementPort,
  type V3BackupReplacementRequest,
  V3BackupMaintenanceError,
} from './v3-backup-maintenance'

if (getApps().length === 0) initializeApp()

const administrationPin = defineSecret('V4_ADMINISTRATION_PIN')
const firestore = getFirestore()
const rootCollection = 'grupos_v4'
const maintenanceBackupsCollection = 'grupos_v4_maintenance_backups'
const knownSubcollections = ['personas', 'aportaciones', 'gastos'] as const

function assertAuthenticated(auth: unknown): void {
  if (!auth) throw new HttpsError('unauthenticated', 'Se requiere una sesión Firebase autenticada.')
}

function groupReference(groupId: string) {
  return firestore.doc(`${rootCollection}/${groupId}`)
}

async function readGroup(groupId: string): Promise<GroupFinancialEntities> {
  const reference = groupReference(groupId)
  const [groupSnapshot, peopleSnapshot, contributionsSnapshot, expensesSnapshot] = await Promise.all([
    reference.get(),
    reference.collection('personas').get(),
    reference.collection('aportaciones').get(),
    reference.collection('gastos').get(),
  ])
  if (!groupSnapshot.exists) throw new V3BackupMaintenanceError('El grupo V4 objetivo no existe.')
  return {
    group: groupSnapshot.data() as GroupFinancialEntities['group'],
    people: peopleSnapshot.docs.map((snapshot) => snapshot.data() as Person),
    contributions: contributionsSnapshot.docs.map((snapshot) => snapshot.data() as Contribution),
    expenses: expensesSnapshot.docs.map((snapshot) => snapshot.data() as Expense),
  }
}

async function assertNoUnknownSubcollections(groupId: string): Promise<void> {
  const names = (await groupReference(groupId).listCollections()).map((collection) => collection.id)
  const unknown = names.filter((name) => !knownSubcollections.includes(name as typeof knownSubcollections[number]))
  if (unknown.length > 0) {
    throw new V3BackupMaintenanceError(`El grupo contiene subcolecciones V4 no reconocidas: ${unknown.join(', ')}.`)
  }
}

async function commitInChunks<T>(items: readonly T[], apply: (batch: ReturnType<typeof firestore.batch>, item: T) => void): Promise<void> {
  const maxBatchWrites = 450
  for (let offset = 0; offset < items.length; offset += maxBatchWrites) {
    const batch = firestore.batch()
    items.slice(offset, offset + maxBatchWrites).forEach((item) => apply(batch, item))
    await batch.commit()
  }
}

async function replaceGroup(groupId: string, entities: GroupFinancialEntities): Promise<void> {
  if (entities.group.id !== groupId) throw new V3BackupMaintenanceError('El reemplazo intenta escribir un grupo distinto al objetivo.')
  await assertNoUnknownSubcollections(groupId)
  const reference = groupReference(groupId)
  const [people, contributions, expenses] = await Promise.all(knownSubcollections.map((name) => reference.collection(name).get()))
  const existing = [...people.docs, ...contributions.docs, ...expenses.docs]
  await commitInChunks(existing, (batch, snapshot) => batch.delete(snapshot.ref))
  await reference.delete()

  const writes: readonly { path: string; data: unknown }[] = [
    { path: reference.path, data: entities.group },
    ...entities.people.map((person) => ({ path: `${reference.path}/personas/${person.id}`, data: person })),
    ...entities.contributions.map((contribution) => ({ path: `${reference.path}/aportaciones/${contribution.id}`, data: contribution })),
    ...entities.expenses.map((expense) => ({ path: `${reference.path}/gastos/${expense.id}`, data: expense })),
  ]
  await commitInChunks(writes, (batch, write) => batch.set(firestore.doc(write.path), write.data))
}

const port: V3BackupReplacementPort = {
  readGroup,
  async saveMaintenanceBackup(backup: MaintenanceBackup): Promise<void> {
    await firestore.collection(maintenanceBackupsCollection).doc(backup.id).create(backup)
  },
  replaceGroup,
}

function withoutPin<T extends { pin?: unknown }>(request: T): Omit<T, 'pin'> {
  const { pin: _pin, ...payload } = request
  return payload
}

function mapError(error: unknown): never {
  if (error instanceof HttpsError) throw error
  if (error instanceof AdministrationAuthorizationError) throw new HttpsError('permission-denied', 'El PIN de Administración no es correcto.')
  if (error instanceof V3BackupMaintenanceError || error instanceof AdministrationRequestError || error instanceof Error) {
    throw new HttpsError('invalid-argument', error.message)
  }
  throw new HttpsError('internal', 'No se ha podido completar el mantenimiento V4.')
}

/** Solo prepara la comparación; no guarda copia ni modifica el grupo. */
export const previewV3BackupReplacementV4 = onCall({ region: V4_FUNCTIONS_REGION, secrets: [administrationPin] }, async (request) => {
  assertAuthenticated(request.auth)
  try {
    const payload = request.data as V3BackupReplacementRequest & { pin?: unknown }
    assertAdministrationPin(payload.pin, administrationPin.value())
    return await previewV3BackupReplacement(withoutPin(payload), port)
  } catch (error) { return mapError(error) }
})

/** Reemplaza exclusivamente el grupo confirmado, siempre tras guardar una copia V4 previa. */
export const replaceV3BackupGroupV4 = onCall({ region: V4_FUNCTIONS_REGION, secrets: [administrationPin] }, async (request) => {
  assertAuthenticated(request.auth)
  try {
    const payload = request.data as V3BackupReplacementConfirmation & { pin?: unknown }
    assertAdministrationPin(payload.pin, administrationPin.value())
    return await replaceV3BackupGroup(withoutPin(payload), port)
  } catch (error) { return mapError(error) }
})
