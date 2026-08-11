import { loadEnv } from 'vite'
import { createGroupFinancialView } from '../src/domain/financial-adapter'
import {
  FirestoreV4ContributionPersistence,
  FirestoreV4ContributionService,
} from '../src/infrastructure/firestore/firestore-v4-contribution-service'
import { FirestoreV4GroupReadService } from '../src/infrastructure/firestore/firestore-v4-group-read-service'
import {
  connectFirebaseForReadOnly,
  readFirebaseOptionsFromEnvironment,
} from '../src/infrastructure/firebase/firebase-client'

const groupId = 'general'
const expectedAfterCreate = {
  contributions: 342,
  pepeBalanceInCents: 774,
  groupBalanceInCents: 7777,
  peopleBalanceSumInCents: 7777,
}
const expectedAfterDelete = {
  contributions: 341,
  pepeBalanceInCents: 674,
  groupBalanceInCents: 7677,
  peopleBalanceSumInCents: 7677,
}

function getTodayInMadrid(): string {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    dateParts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${values.year}-${values.month}-${values.day}`
}

function getSummary(entities: Awaited<ReturnType<FirestoreV4GroupReadService['readGroup']>>, pepeId: string) {
  const view = createGroupFinancialView(entities)
  const pepeBalance = view.personBalances.find((balance) => balance.personId === pepeId)

  if (pepeBalance === undefined) {
    throw new Error('No se ha podido calcular el saldo de Pepe.')
  }

  return {
    contributions: entities.contributions.length,
    pepeBalanceInCents: pepeBalance.availableInCents,
    groupBalanceInCents: view.groupBalance.availableInCents,
    peopleBalanceSumInCents: view.personBalances.reduce(
      (total, balance) => total + balance.availableInCents,
      0,
    ),
  }
}

function assertExactSummary(
  actual: ReturnType<typeof getSummary>,
  expected: typeof expectedAfterCreate,
  stage: string,
): void {
  const mismatch = Object.entries(expected).find(
    ([key, expectedValue]) => actual[key as keyof typeof expected] !== expectedValue,
  )

  if (mismatch !== undefined) {
    throw new Error(
      `${stage}: ${mismatch[0]} es ${actual[mismatch[0] as keyof typeof actual]} y debía ser ${mismatch[1]}. ` +
        'La aportación de prueba no se eliminará automáticamente.',
    )
  }
}

const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))
const groupReader = new FirestoreV4GroupReadService(firestore)
const contributionService = new FirestoreV4ContributionService(
  new FirestoreV4ContributionPersistence(firestore),
)
const initialEntities = await groupReader.readGroup(groupId)
const pepe = initialEntities.people.find((person) => person.name.trim().toLocaleLowerCase('es-ES') === 'pepe')

if (pepe === undefined || !pepe.isActive) {
  throw new Error('No se ha encontrado una persona activa llamada Pepe en grupos_v4/general.')
}

const contributionId = `v4-control-pepe-${getTodayInMadrid().replaceAll('-', '')}-${crypto.randomUUID()}`
const contribution = await contributionService.create(initialEntities.people, initialEntities.contributions, {
  id: contributionId,
  groupId,
  personId: pepe.id,
  amountInCents: 100,
  date: getTodayInMadrid(),
})

const afterCreate = getSummary(await groupReader.readGroup(groupId), pepe.id)
assertExactSummary(afterCreate, expectedAfterCreate, 'Comprobación posterior a la creación')

await contributionService.delete((await groupReader.readGroup(groupId)).contributions, contribution.id)

const afterDelete = getSummary(await groupReader.readGroup(groupId), pepe.id)
assertExactSummary(afterDelete, expectedAfterDelete, 'Comprobación posterior a la eliminación')

console.log(
  JSON.stringify(
    {
      contributionId,
      pepeId: pepe.id,
      afterCreate,
      afterDelete,
      deleted: true,
    },
    null,
    2,
  ),
)
