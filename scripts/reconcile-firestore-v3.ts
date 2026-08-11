import { loadEnv } from 'vite'
import { doc, getDoc } from 'firebase/firestore'
import {
  connectFirebaseForReadOnly,
  readFirebaseOptionsFromEnvironment,
} from '../src/infrastructure/firebase/firebase-client'
import { createGroupFinancialView } from '../src/domain/financial-adapter'
import {
  convertFirestoreV3GroupToV4,
  type FirestoreV3Contribution,
  type FirestoreV3Expense,
  type FirestoreV3GroupDocument,
  type FirestoreV3Person,
} from '../src/infrastructure/firestore/v3-group-converter'

interface V3PersonReconciliation {
  personId: string
  name: string
  v3ContributedInCents: number
  movementsContributedInCents: number
  legacyDifferenceInCents: number
  v3SpentInCents: number
  v3BalanceInCents: number
  v4SpentInCents: number
  v4BalanceInCents: number
}

const toCents = (amount: number): number => Math.round(amount * 100)
const asId = (value: string | number): string => String(value)

function calculateV3SpentInEuros(person: FirestoreV3Person, expenses: readonly FirestoreV3Expense[]): number {
  return expenses.reduce((total, expense) => {
    if (!expense.participantes || !expense.monto || !expense.participantes.includes(person.id)) {
      return total
    }

    if (expense.modo === 'importe' && expense.importesPersona) {
      return total + Number(expense.importesPersona[String(person.id)] ?? 0)
    }

    if (!expense.consumiciones) {
      return total + expense.monto / expense.participantes.length
    }

    const totalConsumptions = expense.participantes.reduce(
      (sum, participantId) => sum + Number(expense.consumiciones?.[String(participantId)] ?? 1),
      0,
    )
    const personConsumptions = Number(expense.consumiciones[String(person.id)] ?? 1)

    return total + (expense.monto * personConsumptions) / totalConsumptions
  }, 0)
}

function calculateMovementContributionInEuros(
  personId: string,
  contributions: readonly FirestoreV3Contribution[],
): number {
  return contributions
    .filter((contribution) => asId(contribution.personaId) === personId)
    .reduce((total, contribution) => total + contribution.amount, 0)
}

const groupId = process.argv[2] ?? 'general'
const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))
const snapshot = await getDoc(doc(firestore, 'grupos', groupId))

if (!snapshot.exists()) {
  throw new Error(`No existe el grupo ${groupId} en Firestore.`)
}

const legacyGroup = snapshot.data() as FirestoreV3GroupDocument
const people = legacyGroup.personas ?? []
const contributions = legacyGroup.aportaciones ?? []
const expenses = legacyGroup.gastos ?? []
const v4View = createGroupFinancialView(convertFirestoreV3GroupToV4(groupId, legacyGroup))

const peopleReconciliation: V3PersonReconciliation[] = people.map((person) => {
  const personId = asId(person.id)
  const v3ContributedInCents = toCents(person.aportado ?? 0)
  const movementsContributedInCents = toCents(
    calculateMovementContributionInEuros(personId, contributions),
  )
  const v3SpentInCents = toCents(calculateV3SpentInEuros(person, expenses))
  const v4Balance = v4View.personBalances.find((balance) => balance.personId === personId)

  if (!v4Balance) throw new Error(`Falta el balance V4 de ${personId}.`)

  return {
    personId,
    name: person.nombre,
    v3ContributedInCents,
    movementsContributedInCents,
    legacyDifferenceInCents: v3ContributedInCents - movementsContributedInCents,
    v3SpentInCents,
    v3BalanceInCents: v3ContributedInCents - v3SpentInCents,
    v4SpentInCents: v4Balance.spentInCents,
    v4BalanceInCents: v4Balance.availableInCents,
  }
})

const v3ContributedInCents = peopleReconciliation.reduce(
  (total, person) => total + person.v3ContributedInCents,
  0,
)
const movementsContributedInCents = peopleReconciliation.reduce(
  (total, person) => total + person.movementsContributedInCents,
  0,
)
const v3SpentInCents = toCents(expenses.reduce((total, expense) => total + expense.monto, 0))
const additionalPersonFinancialFields = [...new Set(
  people.flatMap((person) =>
    Object.keys(person).filter((key) => !['id', 'nombre', 'telefono', 'aportado'].includes(key)),
  ),
)]

console.log(
  JSON.stringify(
    {
      group: { id: groupId, name: legacyGroup.nombreVisible ?? groupId },
      groupReconciliation: {
        v3ContributedInCents,
        movementsContributedInCents,
        differenceInCents: v3ContributedInCents - movementsContributedInCents,
        v3SpentInCents,
        v3BalanceInCents: v3ContributedInCents - v3SpentInCents,
        v4SpentInCents: v4View.groupBalance.spentInCents,
        v4BalanceInCents: v4View.groupBalance.availableInCents,
      },
      additionalPersonFinancialFields,
      people: peopleReconciliation,
      integrity: {
        expenses: v4View.expenseIntegrity.every((check) => check.isConsistent),
        people: v4View.personIntegrity.every((check) => check.isConsistent),
        group: v4View.groupIntegrity.isConsistent,
      },
    },
    null,
    2,
  ),
)

process.exit(0)
