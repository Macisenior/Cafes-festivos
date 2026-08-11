import { loadEnv } from 'vite'
import { collection, getDocs } from 'firebase/firestore'
import { createGroupFinancialView } from '../src/domain/financial-adapter'
import {
  connectFirebaseForReadOnly,
  readFirebaseOptionsFromEnvironment,
} from '../src/infrastructure/firebase/firebase-client'
import {
  convertFirestoreV3GroupToV4,
  type FirestoreV3Contribution,
  type FirestoreV3Expense,
  type FirestoreV3GroupDocument,
  type FirestoreV3Person,
} from '../src/infrastructure/firestore/v3-group-converter'

const toCents = (amount: number): number => Math.round(amount * 100)
const asId = (value: string | number): string => String(value)
const requestedGroupName = process.argv[2] ?? 'Viernes Oficial'
const normalizedRequestedGroupName = requestedGroupName.trim().toLocaleLowerCase('es-ES')

function calculateV3SpentInCents(person: FirestoreV3Person, expenses: readonly FirestoreV3Expense[]): number {
  const spentInEuros = expenses.reduce((total, expense) => {
    if (!expense.participantes.includes(person.id)) return total
    if (expense.modo === 'importe' && expense.importesPersona) {
      return total + Number(expense.importesPersona[asId(person.id)] ?? 0)
    }
    if (!expense.consumiciones) return total + expense.monto / expense.participantes.length

    const totalConsumptions = expense.participantes.reduce(
      (sum, participantId) => sum + Number(expense.consumiciones?.[asId(participantId)] ?? 1),
      0,
    )
    return total + (expense.monto * Number(expense.consumiciones[asId(person.id)] ?? 1)) / totalConsumptions
  }, 0)

  return toCents(spentInEuros)
}

function dateFormat(value: unknown): string {
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'ISO' : 'texto'
  if (value instanceof Date) return 'Date'
  if (typeof value === 'object' && value !== null && 'toDate' in value) return 'Timestamp'
  return typeof value
}

const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))
const groupSnapshots = await getDocs(collection(firestore, 'grupos'))
const candidates = groupSnapshots.docs
  .map((snapshot) => ({ id: snapshot.id, document: snapshot.data() as FirestoreV3GroupDocument }))
  .filter(
    ({ id, document }) =>
      id.trim().toLocaleLowerCase('es-ES') === normalizedRequestedGroupName ||
      document.nombreVisible?.trim().toLocaleLowerCase('es-ES') === normalizedRequestedGroupName,
  )

if (candidates.length !== 1) {
  console.log(JSON.stringify({ candidates: groupSnapshots.docs.map((snapshot) => ({ id: snapshot.id, name: snapshot.data().nombreVisible ?? null })) }, null, 2))
  throw new Error(`Se esperaba exactamente un grupo V3 llamado ${requestedGroupName}; encontrados: ${candidates.length}.`)
}

const { id: groupId, document } = candidates[0]
const people = document.personas ?? []
const contributions = document.aportaciones ?? []
const expenses = document.gastos ?? []
const entities = convertFirestoreV3GroupToV4(groupId, document)
const view = createGroupFinancialView(entities)
const contributionIdCounts = contributions.reduce((counts, contribution) => {
  const id = asId(contribution.id)
  counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}, new Map<string, number>())
const duplicateContributionIds = [...contributionIdCounts.entries()]
  .filter(([, count]) => count > 1)
  .map(([id, count]) => ({ id, count }))
const modeCounts = expenses.reduce((counts, expense) => {
  const mode = expense.modo ?? 'sin-modo'
  counts[mode] = (counts[mode] ?? 0) + 1
  return counts
}, {} as Record<string, number>)

const peopleDiagnostics = people.map((person) => {
  const personId = asId(person.id)
  const movementsInCents = contributions
    .filter((contribution) => asId(contribution.personaId) === personId)
    .reduce((total, contribution) => total + toCents(contribution.amount), 0)
  const v3ContributedInCents = toCents(person.aportado ?? 0)
  const v3SpentInCents = calculateV3SpentInCents(person, expenses)
  const v4Balance = view.personBalances.find((balance) => balance.personId === personId)

  return {
    personId,
    name: person.nombre,
    v3ContributedInCents,
    movementContributedInCents: movementsInCents,
    inheritedOpeningInCents: v3ContributedInCents - movementsInCents,
    v3SpentInCents,
    v3BalanceInCents: v3ContributedInCents - v3SpentInCents,
    v4SpentInCents: v4Balance?.spentInCents ?? null,
    v4BalanceInCents: v4Balance?.availableInCents ?? null,
  }
})

console.log(
  JSON.stringify(
    {
      group: { id: groupId, name: document.nombreVisible ?? groupId },
      counts: {
        people: people.length,
        sourceContributions: contributions.length,
        v4Contributions: entities.contributions.length,
        inheritedOpenings: entities.contributions.filter((contribution) => contribution.source === 'v3-opening').length,
        expenses: expenses.length,
      },
      contributionDuplicateIds: duplicateContributionIds,
      historicalExpenseFormats: {
        modes: modeCounts,
        expenseDateFormats: [...new Set(expenses.map((expense) => dateFormat(expense.fecha)))],
        contributionDateFormats: [...new Set(contributions.map((contribution) => dateFormat(contribution.date)))],
        expensesWithConsumptions: expenses.filter((expense) => expense.consumiciones !== undefined).length,
        expensesWithIndividualAmounts: expenses.filter((expense) => expense.importesPersona != null).length,
      },
      totalsInCents: {
        v3Contributed: peopleDiagnostics.reduce((total, person) => total + person.v3ContributedInCents, 0),
        movementsContributed: peopleDiagnostics.reduce((total, person) => total + person.movementContributedInCents, 0),
        v3Spent: expenses.reduce((total, expense) => total + toCents(expense.monto), 0),
        v3Balance: peopleDiagnostics.reduce((total, person) => total + person.v3BalanceInCents, 0),
        v4Contributed: view.groupBalance.contributedInCents,
        v4Spent: view.groupBalance.spentInCents,
        v4Balance: view.groupBalance.availableInCents,
        v4PeopleBalanceSum: view.personBalances.reduce((total, balance) => total + balance.availableInCents, 0),
      },
      people: peopleDiagnostics,
      integrity: {
        expenses: view.expenseIntegrity.every((check) => check.isConsistent),
        people: view.personIntegrity.every((check) => check.isConsistent),
        group: view.groupIntegrity.isConsistent,
      },
    },
    null,
    2,
  ),
)

process.exit(0)
