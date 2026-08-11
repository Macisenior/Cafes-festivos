import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { createGroupFinancialView, type GroupFinancialView } from '../../domain/financial-adapter'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import {
  convertFirestoreV3GroupToV4,
  type FirestoreV3GroupDocument,
} from './v3-group-converter'

export interface FirestoreGroupReadResult {
  entities: GroupFinancialEntities
  financialView: GroupFinancialView
}

/**
 * Servicio Firestore de primera fase: solo lee `grupos/{groupId}`, convierte
 * el documento V3 y pide los balances al adaptador. No importa APIs de escritura.
 */
export class FirestoreGroupReadService {
  private readonly firestore: Firestore

  constructor(firestore: Firestore) {
    this.firestore = firestore
  }

  async readGroup(groupId: string): Promise<FirestoreGroupReadResult> {
    const snapshot = await getDoc(doc(this.firestore, 'grupos', groupId))

    if (!snapshot.exists()) {
      throw new Error(`No existe el grupo ${groupId} en Firestore.`)
    }

    const entities = convertFirestoreV3GroupToV4(
      groupId,
      snapshot.data() as FirestoreV3GroupDocument,
    )

    return {
      entities,
      financialView: createGroupFinancialView(entities),
    }
  }
}
