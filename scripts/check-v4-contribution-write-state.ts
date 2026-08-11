import { loadEnv } from 'vite'
import { createGroupFinancialView } from '../src/domain/financial-adapter'
import { FirestoreV4GroupReadService } from '../src/infrastructure/firestore/firestore-v4-group-read-service'
import {
  connectFirebaseForReadOnly,
  readFirebaseOptionsFromEnvironment,
} from '../src/infrastructure/firebase/firebase-client'

const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))
const entities = await new FirestoreV4GroupReadService(firestore).readGroup('general')
const view = createGroupFinancialView(entities)
const pepe = entities.people.find((person) => person.name.trim().toLocaleLowerCase('es-ES') === 'pepe')

if (pepe === undefined) {
  throw new Error('No se ha encontrado a Pepe en grupos_v4/general.')
}

const pepeBalance = view.personBalances.find((balance) => balance.personId === pepe.id)
if (pepeBalance === undefined) {
  throw new Error('No se ha encontrado el balance de Pepe.')
}

const possibleControlContributions = entities.contributions.filter(
  (contribution) =>
    contribution.id.startsWith('v4-control-pepe-') ||
    (contribution.personId === pepe.id && contribution.amountInCents === 100 && contribution.source === 'user'),
)

console.log(
  JSON.stringify(
    {
      contributionsCount: entities.contributions.length,
      pepeId: pepe.id,
      pepeBalanceInCents: pepeBalance.availableInCents,
      groupBalanceInCents: view.groupBalance.availableInCents,
      possibleControlContributions,
    },
    null,
    2,
  ),
)
