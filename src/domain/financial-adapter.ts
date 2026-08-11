import type {
  Contribution,
  Expense,
  Group,
  GroupId,
  Person,
} from './entities'
import type {
  FinancialIntegrityCheck,
  GlobalBalance,
  GroupBalance,
  PersonBalance,
} from './balances'
import {
  calculateGlobalBalance,
  calculateGroupBalance,
  calculatePersonBalance,
  checkExpenseIntegrity,
  checkGlobalIntegrity,
  checkGroupIntegrity,
  checkPersonIntegrity,
} from './financial-engine'

/** Entidades de un grupo que se entregan al adaptador, sin persistencia. */
export interface GroupFinancialEntities {
  group: Group
  people: readonly Person[]
  contributions: readonly Contribution[]
  expenses: readonly Expense[]
}

/** Balances e integridad derivados para un único grupo. */
export interface GroupFinancialView {
  groupId: GroupId
  personBalances: readonly PersonBalance[]
  groupBalance: GroupBalance
  expenseIntegrity: readonly FinancialIntegrityCheck[]
  personIntegrity: readonly FinancialIntegrityCheck[]
  groupIntegrity: FinancialIntegrityCheck
}

/** Resultado derivado de todos los grupos disponibles. */
export interface GlobalFinancialView {
  groups: readonly GroupFinancialView[]
  globalBalance: GlobalBalance
  globalIntegrity: FinancialIntegrityCheck
}

/**
 * Adapta las entidades de un grupo a la vista financiera. Los importes y las
 * validaciones se delegan por completo en financial-engine.ts.
 */
export function createGroupFinancialView(entities: GroupFinancialEntities): GroupFinancialView {
  const groupPeople = entities.people.filter((person) => person.groupId === entities.group.id)
  const personBalances = groupPeople.map((person) =>
    calculatePersonBalance(person.id, entities.group.id, entities.contributions, entities.expenses),
  )
  const groupBalance = calculateGroupBalance(
    entities.group.id,
    entities.contributions,
    entities.expenses,
  )

  return {
    groupId: entities.group.id,
    personBalances,
    groupBalance,
    expenseIntegrity: entities.expenses
      .filter((expense) => expense.groupId === entities.group.id)
      .map(checkExpenseIntegrity),
    personIntegrity: personBalances.map(checkPersonIntegrity),
    groupIntegrity: checkGroupIntegrity(groupBalance, personBalances),
  }
}

/**
 * Compone las vistas por grupo y el balance global sin repetir cálculos
 * financieros fuera del motor.
 */
export function createGlobalFinancialView(
  groupEntities: readonly GroupFinancialEntities[],
): GlobalFinancialView {
  const groups = groupEntities.map(createGroupFinancialView)
  const allGroups = groupEntities.map((entities) => entities.group)
  const allContributions = groupEntities.flatMap((entities) => entities.contributions)
  const allExpenses = groupEntities.flatMap((entities) => entities.expenses)
  const globalBalance = calculateGlobalBalance(allGroups, allContributions, allExpenses)

  return {
    groups,
    globalBalance,
    globalIntegrity: checkGlobalIntegrity(globalBalance),
  }
}
