import { loadEnv } from 'vite'
import {
  connectFirebaseForReadOnly,
  readFirebaseOptionsFromEnvironment,
} from '../src/infrastructure/firebase/firebase-client'
import { createGroupFinancialView } from '../src/domain/financial-adapter'
import { FirestoreGroupReadService } from '../src/infrastructure/firestore/firestore-group-read-service'
import { FirestoreV4GroupReadService } from '../src/infrastructure/firestore/firestore-v4-group-read-service'
import { FirestoreV4MigrationService } from '../src/infrastructure/firestore/firestore-v4-migration-service'

const groupId = 'Viernes Oficial'
const expected = {
  peopleCount: 3,
  contributionsCount: 45,
  expensesCount: 25,
  contributedInCents: 46000,
  spentInCents: 45530,
  availableInCents: 470,
  personBalancesInCents: 470,
}

const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))
const source = await new FirestoreGroupReadService(firestore).readGroup(groupId)
const migrationService = new FirestoreV4MigrationService(firestore)

await migrationService.migrateGroup(source.entities)

const migratedEntities = await new FirestoreV4GroupReadService(firestore).readGroup(groupId)
const migratedView = createGroupFinancialView(migratedEntities)
const validation = {
  peopleCount: migratedEntities.people.length,
  contributionsCount: migratedEntities.contributions.length,
  expensesCount: migratedEntities.expenses.length,
  contributedInCents: migratedView.groupBalance.contributedInCents,
  spentInCents: migratedView.groupBalance.spentInCents,
  availableInCents: migratedView.groupBalance.availableInCents,
  personBalancesInCents: migratedView.personBalances.reduce(
    (total, balance) => total + balance.availableInCents,
    0,
  ),
  allocationsConsistent: migratedView.expenseIntegrity.every((check) => check.isConsistent),
  personBalancesConsistent: migratedView.personIntegrity.every((check) => check.isConsistent),
  groupConsistent: migratedView.groupIntegrity.isConsistent,
}

if (Object.entries(expected).some(([key, value]) => validation[key as keyof typeof expected] !== value)) {
  throw new Error('La validación posterior no coincide con los valores aprobados para Viernes Oficial.')
}

if (!validation.allocationsConsistent || !validation.personBalancesConsistent || !validation.groupConsistent) {
  throw new Error('La migración V4 no supera las comprobaciones de integridad.')
}

console.log(JSON.stringify({ target: `grupos_v4/${groupId}`, validation }, null, 2))
process.exit(0)
