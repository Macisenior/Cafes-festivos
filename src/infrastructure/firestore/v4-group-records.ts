import type { Contribution, Expense, Group, Person } from '../../domain/entities'
import { createGroupFinancialView, type GroupFinancialEntities } from '../../domain/financial-adapter'

/** Colección V4 aislada de la colección V3 `grupos`. */
export const V4_GROUPS_COLLECTION = 'grupos_v4'

/** Registros serializables de una migración V4 validada por el dominio. */
export interface FirestoreV4GroupRecords {
  group: Group
  people: readonly Person[]
  contributions: readonly Contribution[]
  expenses: readonly Expense[]
}

/**
 * Prepara los registros V4 sin recalcular ni modificar las entidades. El motor
 * y el adaptador deben validar las asignaciones antes de cualquier escritura.
 */
export function createFirestoreV4GroupRecords(
  entities: GroupFinancialEntities,
): FirestoreV4GroupRecords {
  const view = createGroupFinancialView(entities)

  if (
    !view.groupIntegrity.isConsistent ||
    view.expenseIntegrity.some((check) => !check.isConsistent) ||
    view.personIntegrity.some((check) => !check.isConsistent)
  ) {
    throw new Error('El grupo no supera las comprobaciones financieras V4.')
  }

  return {
    group: entities.group,
    people: entities.people,
    contributions: entities.contributions,
    expenses: entities.expenses,
  }
}
