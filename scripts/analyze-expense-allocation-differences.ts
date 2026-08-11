import { loadEnv } from 'vite'
import { doc, getDoc } from 'firebase/firestore'
import {
  connectFirebaseForReadOnly,
  readFirebaseOptionsFromEnvironment,
} from '../src/infrastructure/firebase/firebase-client'
import {
  convertFirestoreV3GroupToV4,
  type FirestoreV3Expense,
  type FirestoreV3GroupDocument,
} from '../src/infrastructure/firestore/v3-group-converter'

interface AllocationDifference {
  personId: string
  v3InCents: number
  v4InCents: number
  differenceInCents: number
}

const toCents = (amount: number): number => Math.round(amount * 100)

/** Reproducción literal de la rama de reparto usada por V3. */
function calculateV3ShareInEuros(expense: FirestoreV3Expense, personId: string): number {
  const participantIds = expense.participantes.map(String)

  if (expense.modo === 'importe' && expense.importesPersona) {
    return Number(expense.importesPersona[personId] ?? 0)
  }

  if (!expense.consumiciones) {
    return expense.monto / participantIds.length
  }

  const totalConsumptions = participantIds.reduce(
    (total, personId) => total + Number(expense.consumiciones?.[personId] ?? 1),
    0,
  )

  return (expense.monto * Number(expense.consumiciones[personId] ?? 1)) / totalConsumptions
}

function calculateV3Allocations(expense: FirestoreV3Expense): Readonly<Record<string, number>> {
  return Object.fromEntries(
    expense.participantes.map(String).map((personId) => [
      personId,
      toCents(calculateV3ShareInEuros(expense, personId)),
    ]),
  )
}

function classifyCause(expense: FirestoreV3Expense): string {
  if (!expense.modo && expense.consumiciones) {
    return 'Formato histórico sin modo con consumiciones'
  }
  if (!expense.modo) return 'Redondeo de reparto Igual (formato histórico sin modo)'
  if (expense.modo === 'igual' && expense.consumiciones) {
    return 'Reparto Igual con consumiciones heredadas'
  }
  if (expense.modo === 'igual') return 'Redondeo de reparto Igual'
  if (expense.modo === 'consumiciones') return 'Redondeo de Consumiciones'
  if (expense.modo === 'importe') return 'Redondeo de Importe por persona'
  return 'Otro formato histórico'
}

const groupId = process.argv[2] ?? 'general'
const environment = loadEnv('development', process.cwd(), 'VITE_')
const firestore = await connectFirebaseForReadOnly(readFirebaseOptionsFromEnvironment(environment))
const snapshot = await getDoc(doc(firestore, 'grupos', groupId))

if (!snapshot.exists()) {
  throw new Error(`No existe el grupo ${groupId} en Firestore.`)
}

const legacyGroup = snapshot.data() as FirestoreV3GroupDocument
const legacyExpenses = legacyGroup.gastos ?? []
const v4Expenses = convertFirestoreV3GroupToV4(groupId, legacyGroup).expenses
const v4ExpensesById = new Map(v4Expenses.map((expense) => [expense.id, expense]))
const differences = legacyExpenses.flatMap((legacyExpense) => {
  const v4Expense = v4ExpensesById.get(String(legacyExpense.id))
  if (!v4Expense) throw new Error(`No se convirtió el gasto ${legacyExpense.id}.`)

  const v3Allocations = calculateV3Allocations(legacyExpense)
  const v4Allocations = Object.fromEntries(
    v4Expense.allocations.map((allocation) => [allocation.personId, allocation.amountInCents]),
  )
  const allocations = legacyExpense.participantes
    .map(String)
    .map<AllocationDifference>((personId) => ({
      personId,
      v3InCents: v3Allocations[personId],
      v4InCents: v4Allocations[personId],
      differenceInCents: v4Allocations[personId] - v3Allocations[personId],
    }))
    .filter((allocation) => allocation.differenceInCents !== 0)

  if (allocations.length === 0) return []

  return [{
    expenseId: String(legacyExpense.id),
    date: String(legacyExpense.fecha),
    site: legacyExpense.sitio ?? '',
    concept: legacyExpense.descripcion ?? '',
    mode: legacyExpense.modo ?? 'sin modo',
    cause: classifyCause(legacyExpense),
    allocations,
  }]
})
const perCause = Object.entries(
  Object.groupBy(differences, (difference) => difference.cause),
).map(([cause, items]) => ({
  cause,
  affectedExpenses: items.length,
  affectedPeople: new Set(items.flatMap((item) => item.allocations.map((allocation) => allocation.personId))).size,
  absoluteDifferenceInCents: items.reduce(
    (total, item) =>
      total + item.allocations.reduce((expenseTotal, allocation) => expenseTotal + Math.abs(allocation.differenceInCents), 0),
    0,
  ),
  netDifferenceInCents: items.reduce(
    (total, item) =>
      total + item.allocations.reduce((expenseTotal, allocation) => expenseTotal + allocation.differenceInCents, 0),
    0,
  ),
}))
const perPerson = Object.entries(
  Object.groupBy(
    differences.flatMap((difference) => difference.allocations),
    (allocation) => allocation.personId,
  ),
)
  .map(([personId, allocations]) => ({
    personId,
    affectedExpenses: allocations.length,
    accumulatedDifferenceInCents: allocations.reduce(
      (total, allocation) => total + allocation.differenceInCents,
      0,
    ),
    absoluteDifferenceInCents: allocations.reduce(
      (total, allocation) => total + Math.abs(allocation.differenceInCents),
      0,
    ),
  }))
  .sort((left, right) => left.personId.localeCompare(right.personId))
  .map((person) => {
    const v3AggregateSpentInCents = toCents(
      legacyExpenses.reduce((total, expense) => {
        if (!expense.participantes.map(String).includes(person.personId)) return total
        return total + calculateV3ShareInEuros(expense, person.personId)
      }, 0),
    )
    const v4AggregateSpentInCents = v4Expenses.reduce(
      (total, expense) =>
        total + (expense.allocations.find((allocation) => allocation.personId === person.personId)?.amountInCents ?? 0),
      0,
    )

    return {
      ...person,
      v3AggregateSpentInCents,
      v4AggregateSpentInCents,
      balanceRelevantDifferenceInCents: v4AggregateSpentInCents - v3AggregateSpentInCents,
    }
  })

console.log(
  JSON.stringify(
    {
      groupId,
      expensesRead: legacyExpenses.length,
      affectedExpenses: differences.length,
      affectedPeople: perPerson.length,
      perCause,
      perPerson,
      affectedExpensesDetail: differences,
    },
    null,
    2,
  ),
)

process.exit(0)
