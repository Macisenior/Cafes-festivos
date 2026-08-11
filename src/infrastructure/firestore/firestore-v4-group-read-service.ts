import { collection, doc, getDoc, getDocs, type Firestore } from 'firebase/firestore'
import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'

const V4_GROUPS_COLLECTION = 'grupos_v4'

/**
 * Lectura exclusiva del agregado V4 persistido. No contiene operaciones de escritura.
 */
export class FirestoreV4GroupReadService {
  private readonly firestore: Firestore

  constructor(firestore: Firestore) {
    this.firestore = firestore
  }

  async listAvailableGroups(): Promise<readonly Group[]> {
    const groupsSnapshot = await getDocs(collection(this.firestore, V4_GROUPS_COLLECTION))

    return groupsSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })) as Group[]
  }

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
      group: { id: groupSnapshot.id, ...groupSnapshot.data() } as Group,
      people: peopleSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data(),
      })) as Person[],
      contributions: contributionsSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data(),
      })) as Contribution[],
      expenses: expensesSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data(),
      })) as Expense[],
    }
  }
}
