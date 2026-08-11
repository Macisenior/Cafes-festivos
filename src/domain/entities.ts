import type { MovementDate } from './dates'
import type { AmountInCents } from './money'
import type {
  ExpenseAllocation,
  ExpenseDistribution,
  PersonId,
} from './reparto'

/** Identificadores estables requeridos para editar movimientos concretos. */
export type GroupId = string
export type ContributionId = string
export type ExpenseId = string

/** Una persona puede mantenerse en el historial aunque ya no esté activa. */
export interface Person {
  id: PersonId
  groupId: GroupId
  name: string
  phone: string
  isActive: boolean
}

/** Sitio configurable para gastos futuros. */
export interface SiteOption {
  id: string
  name: string
}

/**
 * Cada grupo conserva sus propios datos y configuración. El grupo principal
 * está protegido frente a la eliminación.
 */
export interface Group {
  id: GroupId
  name: string
  isMainGroup: boolean
  siteOptions: readonly SiteOption[]
}

/** Movimiento individual de entrada de dinero de una persona. */
export interface Contribution {
  id: ContributionId
  groupId: GroupId
  personId: PersonId
  /** `null` cuando una aportación heredada no tiene fecha histórica fiable. */
  date: MovementDate | null
  amountInCents: AmountInCents
  /** Marca una aportación de apertura reconstruida exclusivamente desde V3. */
  source?: 'v3-opening' | 'user'
}

/**
 * Movimiento de gasto del monedero común.
 *
 * No contiene pagador individual: el reparto final almacenado es la referencia
 * de balances, históricos y futuros informes.
 */
export interface Expense {
  id: ExpenseId
  groupId: GroupId
  date: MovementDate
  concept: string
  siteName: string
  totalInCents: AmountInCents
  participantIds: readonly PersonId[]
  distribution: ExpenseDistribution
  allocations: readonly ExpenseAllocation[]
}

/**
 * Borrador de Gasto Rápido destinado exclusivamente a comunicación.
 * No es un gasto ni un movimiento financiero y no se persiste como tal.
 */
export interface QuickExpenseNotice {
  amountInCents: AmountInCents
  siteName?: string
  concept?: string
  reportedPayerPersonId?: PersonId
}
