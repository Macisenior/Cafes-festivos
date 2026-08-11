import type {
  Contribution,
  Expense,
  Group,
  Person,
  SiteOption,
} from '../../domain/entities'
import { calculateExpenseAllocations } from '../../domain/financial-engine'
import type { ExpenseDistribution, PersonId } from '../../domain/reparto'
import type { GroupFinancialEntities } from '../../domain/financial-adapter'

type LegacyIdentifier = string | number
type LegacyDate = string | Date | { toDate: () => Date }

/** Forma realmente leída de `grupos/{id}` en Firestore V3. */
export interface FirestoreV3GroupDocument {
  nombreVisible?: string
  personas?: readonly FirestoreV3Person[]
  aportaciones?: readonly FirestoreV3Contribution[]
  gastos?: readonly FirestoreV3Expense[]
}

export interface FirestoreV3Person {
  id: LegacyIdentifier
  nombre: string
  telefono?: string
  aportado?: number
}

export interface FirestoreV3Contribution {
  id: LegacyIdentifier
  personaId: LegacyIdentifier
  nombre?: string
  amount: number
  date: LegacyDate
}

export interface FirestoreV3Expense {
  id: LegacyIdentifier
  sitio?: string
  descripcion?: string
  monto: number
  participantes: readonly LegacyIdentifier[]
  consumiciones?: Readonly<Record<string, number>>
  modo?: string
  importesPersona?: Readonly<Record<string, number>> | null
  fecha: LegacyDate
}

const legacyDefaultSites: readonly SiteOption[] = [
  { id: 'Flap', name: 'Flap' },
  { id: 'Colono', name: 'Colono' },
  { id: 'Lydo', name: 'Lydo' },
]

function toStableId(identifier: LegacyIdentifier): string {
  return String(identifier)
}

function toCents(amountInEuros: number, field: string): number {
  if (!Number.isFinite(amountInEuros)) {
    throw new Error(`${field} de V3 no es un importe numérico.`)
  }

  return Math.round(amountInEuros * 100)
}

function toIsoDate(value: LegacyDate, field: string): string {
  const date = value instanceof Date ? value : typeof value === 'string' ? undefined : value.toDate()

  if (date) {
    if (Number.isNaN(date.valueOf())) throw new Error(`${field} de V3 no es una fecha válida.`)
    return date.toISOString().slice(0, 10)
  }

  const text = value as string
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (!match) throw new Error(`${field} de V3 debe tener formato ISO o DD/MM/AAAA.`)

  const [, day, month, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function hasValidConsumptions(expense: FirestoreV3Expense): boolean {
  if (!expense.consumiciones) return false

  return expense.participantes.every((participantId) => {
    const amount = expense.consumiciones?.[toStableId(participantId)]
    return typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0
  })
}

function convertDistribution(expense: FirestoreV3Expense): ExpenseDistribution {
  const participantIds = expense.participantes.map(toStableId)
  const mode = expense.modo

  switch (mode) {
    case 'igual':
      // La regla V4 establece que los residuos de consumiciones no alteran Igual.
      return { mode: 'igual' }
    case 'consumiciones':
      return {
        mode: 'consumiciones',
        consumptionsByPersonId: Object.fromEntries(
          participantIds.map((personId) => [personId, expense.consumiciones?.[personId] ?? 1]),
        ),
      }
    case 'importe':
      return {
        mode: 'importe',
        amountsByPersonId: Object.fromEntries(
          participantIds.map((personId) => [
            personId,
            toCents(expense.importesPersona?.[personId] ?? 0, `El importe individual de ${personId}`),
          ]),
        ),
      }
    default:
      if (hasValidConsumptions(expense)) {
        return {
          mode: 'consumiciones',
          consumptionsByPersonId: Object.fromEntries(
            participantIds.map((personId) => [personId, Number(expense.consumiciones?.[personId])]),
          ),
        }
      }

      return { mode: 'igual' }
  }
}

function convertPerson(groupId: string, person: FirestoreV3Person): Person {
  return {
    id: toStableId(person.id),
    groupId,
    name: person.nombre,
    phone: person.telefono ?? '',
    // V3 no conserva un estado de baja; toda persona existente se considera activa al leerla.
    isActive: true,
  }
}

function convertContribution(
  groupId: string,
  contribution: FirestoreV3Contribution,
  v4ContributionId: string,
): Contribution {
  return {
    id: v4ContributionId,
    groupId,
    personId: toStableId(contribution.personaId),
    date: toIsoDate(contribution.date, 'La fecha de aportación'),
    amountInCents: toCents(contribution.amount, 'La aportación'),
  }
}

function createV3OpeningContribution(
  groupId: string,
  person: FirestoreV3Person,
  convertedContributions: readonly Contribution[],
): Contribution | null {
  const personId = toStableId(person.id)
  const recordedInCents = convertedContributions
    .filter((contribution) => contribution.personId === personId)
    .reduce((total, contribution) => total + contribution.amountInCents, 0)
  const currentV3AmountInCents = toCents(person.aportado ?? 0, `El acumulado de ${person.nombre}`)
  const openingAmountInCents = currentV3AmountInCents - recordedInCents

  if (openingAmountInCents === 0) return null

  return {
    id: `v3-opening:${groupId}:${personId}`,
    groupId,
    personId,
    // V3 no proporciona una fecha histórica fiable para este saldo heredado.
    date: null,
    amountInCents: openingAmountInCents,
    source: 'v3-opening',
  }
}

function convertExpense(groupId: string, legacyExpense: FirestoreV3Expense): Expense {
  const expenseWithoutAllocations = {
    id: toStableId(legacyExpense.id),
    groupId,
    date: toIsoDate(legacyExpense.fecha, 'La fecha de gasto'),
    concept: legacyExpense.descripcion ?? '',
    siteName: legacyExpense.sitio ?? '',
    totalInCents: toCents(legacyExpense.monto, 'El total del gasto'),
    participantIds: legacyExpense.participantes.map(toStableId) as readonly PersonId[],
    distribution: convertDistribution(legacyExpense),
    allocations: [],
  } satisfies Expense

  return {
    ...expenseWithoutAllocations,
    allocations: calculateExpenseAllocations(expenseWithoutAllocations),
  }
}

/**
 * Convierte un documento V3 en entidades V4 en memoria. No realiza escrituras
 * ni usa el campo acumulado `personas[].aportado` como movimiento financiero.
 */
export function convertFirestoreV3GroupToV4(
  groupId: string,
  document: FirestoreV3GroupDocument,
): GroupFinancialEntities {
  const group: Group = {
    id: groupId,
    name: document.nombreVisible ?? groupId,
    isMainGroup: groupId === 'general',
    siteOptions: legacyDefaultSites,
  }

  const people = (document.personas ?? []).map((person) => convertPerson(groupId, person))
  const legacyContributions = document.aportaciones ?? []
  const contributionIdCounts = new Map<string, number>()
  legacyContributions.forEach((contribution) => {
    const id = toStableId(contribution.id)
    contributionIdCounts.set(id, (contributionIdCounts.get(id) ?? 0) + 1)
  })
  const contributionOccurrences = new Map<string, number>()
  const recordedContributions = legacyContributions.map((contribution) => {
    const legacyId = toStableId(contribution.id)
    const occurrence = contributionOccurrences.get(legacyId) ?? 0
    contributionOccurrences.set(legacyId, occurrence + 1)
    const totalOccurrences = contributionIdCounts.get(legacyId) ?? 1
    // El último duplicado conserva el ID V3 ya escrito; los anteriores reciben
    // un ID V4 estable para evitar que Firestore los sobrescriba.
    const v4ContributionId =
      totalOccurrences > 1 && occurrence < totalOccurrences - 1
        ? `v3-contribution:${legacyId}:${occurrence + 1}`
        : legacyId

    return convertContribution(groupId, contribution, v4ContributionId)
  })
  const openingContributions = (document.personas ?? [])
    .map((person) => createV3OpeningContribution(groupId, person, recordedContributions))
    .filter((contribution): contribution is Contribution => contribution !== null)

  return {
    group,
    people,
    contributions: [...recordedContributions, ...openingContributions],
    expenses: (document.gastos ?? []).map((expense) => convertExpense(groupId, expense)),
  }
}
