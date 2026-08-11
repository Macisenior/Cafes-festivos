import type { GroupId } from './entities'
import type { AmountInCents } from './money'
import type { PersonId } from './reparto'

/** Resumen derivado de una persona; no se almacena como movimiento. */
export interface PersonBalance {
  personId: PersonId
  contributedInCents: AmountInCents
  spentInCents: AmountInCents
  availableInCents: AmountInCents
}

/** Estado derivado del monedero de un grupo. */
export interface GroupBalance {
  groupId: GroupId
  contributedInCents: AmountInCents
  spentInCents: AmountInCents
  availableInCents: AmountInCents
}

/** Resumen derivado para la consulta global de Administración. */
export interface GlobalBalance {
  groups: readonly GroupBalance[]
  availableInCents: AmountInCents
}

/** Resultado contractual de una comprobación de integridad financiera. */
export interface FinancialIntegrityCheck {
  scope: 'expense' | 'person' | 'group' | 'global'
  isConsistent: boolean
}
