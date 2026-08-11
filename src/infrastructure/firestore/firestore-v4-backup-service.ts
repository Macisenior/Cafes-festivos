import { collection, deleteDoc, doc, getDocs, setDoc, type Firestore } from 'firebase/firestore'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'
import { createV4Backup, parseV4Backup, type V4Backup } from '../../features/administracion/v4-backup'
import { V4_GROUPS_COLLECTION } from './v4-group-records'

export interface V4BackupReadPort { listAvailableGroups(): Promise<readonly { id: string }[]>; readGroup(groupId: string): Promise<GroupFinancialEntities> }
export interface V4BackupPersistencePort { replaceAll(backup: V4Backup): Promise<void> }

/** Servicio de aplicación: serializa/valida antes de delegar una restauración V4. */
export class FirestoreV4BackupService {
  private readonly reader: V4BackupReadPort
  private readonly persistence: V4BackupPersistencePort

  constructor(reader: V4BackupReadPort, persistence: V4BackupPersistencePort) { this.reader = reader; this.persistence = persistence }

  async createBackup(generatedAt: string): Promise<V4Backup> {
    const groups = await this.reader.listAvailableGroups()
    return createV4Backup(await Promise.all(groups.map((group) => this.reader.readGroup(group.id))), generatedAt)
  }

  async restore(json: string): Promise<V4Backup> {
    const backup = parseV4Backup(json)
    await this.persistence.replaceAll(backup)
    return backup
  }
}

/** Reemplazo explícito de la estructura conocida grupos_v4/{grupo}/{personas|aportaciones|gastos}. Nunca toca V3. */
export class FirestoreV4BackupPersistence implements V4BackupPersistencePort {
  private readonly firestore: Firestore

  constructor(firestore: Firestore) { this.firestore = firestore }

  async replaceAll(backup: V4Backup): Promise<void> {
    const currentGroups = await getDocs(collection(this.firestore, V4_GROUPS_COLLECTION))
    for (const groupSnapshot of currentGroups.docs) {
      const groupRef = doc(this.firestore, V4_GROUPS_COLLECTION, groupSnapshot.id)
      const [people, contributions, expenses] = await Promise.all(['personas', 'aportaciones', 'gastos'].map((name) => getDocs(collection(groupRef, name))))
      for (const snapshot of [...people.docs, ...contributions.docs, ...expenses.docs]) await deleteDoc(snapshot.ref)
      await deleteDoc(groupRef)
    }
    for (const entities of backup.groups) {
      const groupRef = doc(this.firestore, V4_GROUPS_COLLECTION, entities.group.id)
      await setDoc(groupRef, entities.group)
      for (const person of entities.people) await setDoc(doc(groupRef, 'personas', person.id), person)
      for (const contribution of entities.contributions) await setDoc(doc(groupRef, 'aportaciones', contribution.id), contribution)
      for (const expense of entities.expenses) await setDoc(doc(groupRef, 'gastos', expense.id), expense)
    }
  }
}
