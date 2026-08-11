import { loadEnv } from 'vite'
import {
  connectFirebaseForReadOnly,
  readFirebaseOptionsFromEnvironment,
} from '../src/infrastructure/firebase/firebase-client'
import { createGroupFinancialView } from '../src/domain/financial-adapter'
import { FirestoreV4MigrationService } from '../src/infrastructure/firestore/firestore-v4-migration-service'

const groupId = process.argv[2] ?? 'general'
const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))
const service = new FirestoreV4MigrationService(firestore)
const entities = await service.readGroup(groupId)
const view = createGroupFinancialView(entities)

console.log(
  JSON.stringify(
    {
      group: entities.group,
      peopleCount: entities.people.length,
      contributionsCount: entities.contributions.length,
      expensesCount: entities.expenses.length,
      groupBalance: view.groupBalance,
      personBalancesInCents: view.personBalances.reduce(
        (total, balance) => total + balance.availableInCents,
        0,
      ),
      allocationsConsistent: view.expenseIntegrity.every((check) => check.isConsistent),
      personBalancesConsistent: view.personIntegrity.every((check) => check.isConsistent),
      groupConsistent: view.groupIntegrity.isConsistent,
    },
    null,
    2,
  ),
)

process.exit(0)
