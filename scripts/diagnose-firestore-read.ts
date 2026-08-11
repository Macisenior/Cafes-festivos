import { loadEnv } from 'vite'
import { connectFirebaseForReadOnly } from '../src/infrastructure/firebase/firebase-client'
import { readFirebaseOptionsFromEnvironment } from '../src/infrastructure/firebase/firebase-client'
import { FirestoreGroupReadService } from '../src/infrastructure/firestore/firestore-group-read-service'

const groupId = process.argv[2] ?? 'general'
const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))
const service = new FirestoreGroupReadService(firestore)
const result = await service.readGroup(groupId)
const expenseChecks = result.financialView.expenseIntegrity
const personChecks = result.financialView.personIntegrity

console.log(
  JSON.stringify(
    {
      group: { id: result.entities.group.id, name: result.entities.group.name },
      peopleCount: result.entities.people.length,
      contributionsCount: result.entities.contributions.length,
      expensesCount: result.entities.expenses.length,
      groupBalanceInCents: result.financialView.groupBalance,
      personBalancesInCents: result.financialView.personBalances,
      integrity: {
        expenses: {
          total: expenseChecks.length,
          allConsistent: expenseChecks.every((check) => check.isConsistent),
        },
        people: {
          total: personChecks.length,
          allConsistent: personChecks.every((check) => check.isConsistent),
        },
        group: result.financialView.groupIntegrity.isConsistent,
      },
    },
    null,
    2,
  ),
)

process.exit(0)
