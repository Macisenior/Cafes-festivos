import {
  collection,
  doc,
  getDoc,
  getDocs,
  type Firestore,
  writeBatch,
} from 'firebase/firestore'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import type { Contribution, Expense, Person } from '../../domain/entities'
import { createFirestoreV4GroupRecords, V4_GROUPS_COLLECTION } from './v4-group-records'

const MAX_WRITES_PER_BATCH = 450

/**
 * Persistencia V4 para una migración inicial. Nunca consulta ni escribe la
 * colección V3 `grupos`; opera exclusivamente bajo `grupos_v4/{groupId}`.
 */
export class FirestoreV4MigrationService {
  private readonly firestore: Firestore

  constructor(firestore: Firestore) {
    this.firestore = firestore
  }

  async migrateGroup(entities: GroupFinancialEntities): Promise<void> {
    const records = createFirestoreV4GroupRecords(entities)
    const groupReference = doc(this.firestore, V4_GROUPS_COLLECTION, records.group.id)
    const currentGroup = await getDoc(groupReference)

    if (currentGroup.exists()) {
      throw new Error(`Ya existe una migración V4 para el grupo ${records.group.id}.`)
    }

    const writes = [
      { reference: groupReference, data: records.group },
      ...records.people.map((person) => ({
        reference: doc(groupReference, 'personas', person.id),
        data: person,
      })),
      ...records.contributions.map((contribution) => ({
        reference: doc(groupReference, 'aportaciones', contribution.id),
        data: contribution,
      })),
      ...records.expenses.map((expense) => ({
        reference: doc(groupReference, 'gastos', expense.id),
        data: expense,
      })),
    ]

    for (let offset = 0; offset < writes.length; offset += MAX_WRITES_PER_BATCH) {
      const batch = writeBatch(this.firestore)

      writes.slice(offset, offset + MAX_WRITES_PER_BATCH).forEach((write) => {
        batch.set(write.reference, write.data)
      })

      await batch.commit()
    }
  }

  /**
   * Completa únicamente aportaciones no presentes en una migración ya creada.
   * No sobrescribe documentos existentes ni modifica ningún dato de V3.
   */
  async completeMissingContributions(entities: GroupFinancialEntities): Promise<number> {
    const records = createFirestoreV4GroupRecords(entities)
    const groupReference = doc(this.firestore, V4_GROUPS_COLLECTION, records.group.id)
    const currentGroup = await getDoc(groupReference)

    if (!currentGroup.exists()) {
      throw new Error(`No existe una migración V4 para el grupo ${records.group.id}.`)
    }

    const existingContributions = await getDocs(collection(groupReference, 'aportaciones'))
    const existingIds = new Set(existingContributions.docs.map((snapshot) => snapshot.id))
    const missingContributions = records.contributions.filter(
      (contribution) => !existingIds.has(contribution.id),
    )

    for (let offset = 0; offset < missingContributions.length; offset += MAX_WRITES_PER_BATCH) {
      const batch = writeBatch(this.firestore)

      missingContributions.slice(offset, offset + MAX_WRITES_PER_BATCH).forEach((contribution) => {
        batch.set(doc(groupReference, 'aportaciones', contribution.id), contribution)
      })

      await batch.commit()
    }

    return missingContributions.length
  }

  /** Lee una migración V4 para validarla mediante el adaptador y el motor. */
  async readGroup(groupId: string): Promise<GroupFinancialEntities> {
    const groupReference = doc(this.firestore, V4_GROUPS_COLLECTION, groupId)
    const groupSnapshot = await getDoc(groupReference)

    if (!groupSnapshot.exists()) {
      throw new Error(`No existe el grupo V4 ${groupId}.`)
    }

    const [peopleSnapshot, contributionsSnapshot, expensesSnapshot] = await Promise.all([
      getDocs(collection(groupReference, 'personas')),
      getDocs(collection(groupReference, 'aportaciones')),
      getDocs(collection(groupReference, 'gastos')),
    ])

    return {
      group: groupSnapshot.data() as GroupFinancialEntities['group'],
      people: peopleSnapshot.docs.map((snapshot) => snapshot.data() as Person),
      contributions: contributionsSnapshot.docs.map(
        (snapshot) => snapshot.data() as Contribution,
      ),
      expenses: expensesSnapshot.docs.map((snapshot) => snapshot.data() as Expense),
    }
  }
}
