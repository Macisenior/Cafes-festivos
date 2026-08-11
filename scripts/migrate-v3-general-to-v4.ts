import { loadEnv } from 'vite'
import {
  connectFirebaseForReadOnly,
  readFirebaseOptionsFromEnvironment,
} from '../src/infrastructure/firebase/firebase-client'
import { createGroupFinancialView } from '../src/domain/financial-adapter'
import { FirestoreGroupReadService } from '../src/infrastructure/firestore/firestore-group-read-service'
import { FirestoreV4MigrationService } from '../src/infrastructure/firestore/firestore-v4-migration-service'

const groupId = 'general'
const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))

// Esta lectura solo consulta la fuente V3; el servicio de migración escribe solo en grupos_v4.
const v3Service = new FirestoreGroupReadService(firestore)
const source = await v3Service.readGroup(groupId)
const v4Service = new FirestoreV4MigrationService(firestore)

let addedMissingContributions = 0

try {
  await v4Service.migrateGroup(source.entities)
} catch (error) {
  if (!(error instanceof Error) || !error.message.startsWith('Ya existe una migración V4')) {
    throw error
  }

  addedMissingContributions = await v4Service.completeMissingContributions(source.entities)
}

const migratedEntities = await v4Service.readGroup(groupId)
const migratedView = createGroupFinancialView(migratedEntities)
const totalPersonBalancesInCents = migratedView.personBalances.reduce(
  (total, balance) => total + balance.availableInCents,
  0,
)
const validation = {
  peopleCount: migratedEntities.people.length,
  contributionsCount: migratedEntities.contributions.length,
  expensesCount: migratedEntities.expenses.length,
  contributedInCents: migratedView.groupBalance.contributedInCents,
  spentInCents: migratedView.groupBalance.spentInCents,
  availableInCents: migratedView.groupBalance.availableInCents,
  personBalancesInCents: totalPersonBalancesInCents,
  allocationsConsistent: migratedView.expenseIntegrity.every((check) => check.isConsistent),
  personBalancesConsistent: migratedView.personIntegrity.every((check) => check.isConsistent),
  groupConsistent: migratedView.groupIntegrity.isConsistent,
}

const expected = {
  peopleCount: 11,
  contributionsCount: 341,
  expensesCount: 211,
  contributedInCents: 392797,
  spentInCents: 385120,
  availableInCents: 7677,
  personBalancesInCents: 7677,
}

if (Object.entries(expected).some(([key, value]) => validation[key as keyof typeof expected] !== value)) {
  throw new Error('La validación posterior a la migración no coincide con los valores esperados.')
}

if (!validation.allocationsConsistent || !validation.personBalancesConsistent || !validation.groupConsistent) {
  throw new Error('La migración V4 no supera las comprobaciones de integridad.')
}

console.log(
  JSON.stringify({ target: `grupos_v4/${groupId}`, addedMissingContributions, validation }, null, 2),
)
process.exit(0)
