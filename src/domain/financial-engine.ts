import type { Contribution, Expense, Group, GroupId } from './entities'
import type {
  FinancialIntegrityCheck,
  GlobalBalance,
  GroupBalance,
  PersonBalance,
} from './balances'
import type { AmountInCents } from './money'
import type { ExpenseAllocation, PersonId } from './reparto'

/** Error de una entrada que no respeta las reglas financieras de V4. */
export class FinancialDomainError extends Error {}

const sumAmounts = (amounts: readonly AmountInCents[]): AmountInCents =>
  amounts.reduce((total, amount) => total + amount, 0)

function assertAmountInCents(amount: AmountInCents, field: string): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new FinancialDomainError(`${field} debe ser un número entero de céntimos no negativo.`)
  }
}

function assertSignedAmountInCents(amount: AmountInCents, field: string): void {
  if (!Number.isSafeInteger(amount)) {
    throw new FinancialDomainError(`${field} debe ser un número entero de céntimos.`)
  }
}

function assertParticipants(participantIds: readonly PersonId[]): void {
  if (participantIds.length === 0) {
    throw new FinancialDomainError('Un gasto debe tener al menos una persona participante.')
  }

  if (new Set(participantIds).size !== participantIds.length) {
    throw new FinancialDomainError('Una persona solo puede participar una vez en un gasto.')
  }
}

function assertExpenseTotal(expense: Expense): void {
  assertAmountInCents(expense.totalInCents, 'El total del gasto')
  assertParticipants(expense.participantIds)
}

/**
 * Calcula el reparto canónico de un gasto. El resultado siempre está expresado
 * en céntimos y suma exactamente el total del gasto.
 */
export function calculateExpenseAllocations(expense: Expense): readonly ExpenseAllocation[] {
  assertExpenseTotal(expense)

  switch (expense.distribution.mode) {
    case 'igual': {
      const baseAmount = Math.floor(expense.totalInCents / expense.participantIds.length)
      const remainingCents = expense.totalInCents % expense.participantIds.length

      return expense.participantIds.map((personId, index) => ({
        personId,
        amountInCents: baseAmount + (index < remainingCents ? 1 : 0),
      }))
    }

    case 'consumiciones': {
      const distribution = expense.distribution
      const quantities = expense.participantIds.map((personId) => {
        const quantity = distribution.consumptionsByPersonId[personId]

        if (!Number.isSafeInteger(quantity) || quantity <= 0) {
          throw new FinancialDomainError('Cada participante debe tener un número positivo de consumiciones.')
        }

        return quantity
      })
      const totalConsumptions = quantities.reduce((total, quantity) => total + quantity, 0)
      const provisionalAllocations = expense.participantIds.map((personId, index) => {
        const numerator = expense.totalInCents * quantities[index]

        return {
          personId,
          amountInCents: Math.floor(numerator / totalConsumptions),
          remainder: numerator % totalConsumptions,
          index,
        }
      })
      const remainingCents = expense.totalInCents - sumAmounts(
        provisionalAllocations.map((allocation) => allocation.amountInCents),
      )

      provisionalAllocations
        .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
        .slice(0, remainingCents)
        .forEach((allocation) => {
          allocation.amountInCents += 1
        })

      return provisionalAllocations
        .sort((left, right) => left.index - right.index)
        .map(({ personId, amountInCents }) => ({ personId, amountInCents }))
    }

    case 'importe': {
      const distribution = expense.distribution
      const allocations = expense.participantIds.map((personId) => {
        const amountInCents = distribution.amountsByPersonId[personId]
        assertAmountInCents(amountInCents, `El importe de ${personId}`)

        return { personId, amountInCents }
      })

      if (sumAmounts(allocations.map((allocation) => allocation.amountInCents)) !== expense.totalInCents) {
        throw new FinancialDomainError('Los importes individuales deben sumar exactamente el total del gasto.')
      }

      return allocations
    }
  }
}

function allocationsMatch(
  storedAllocations: readonly ExpenseAllocation[],
  expectedAllocations: readonly ExpenseAllocation[],
): boolean {
  if (storedAllocations.length !== expectedAllocations.length) return false

  const storedByPersonId = new Map(storedAllocations.map((allocation) => [allocation.personId, allocation.amountInCents]))
  if (storedByPersonId.size !== storedAllocations.length) return false

  return expectedAllocations.every(
    (allocation) => storedByPersonId.get(allocation.personId) === allocation.amountInCents,
  )
}

function getConsistentAllocations(expense: Expense): readonly ExpenseAllocation[] {
  const expectedAllocations = calculateExpenseAllocations(expense)

  if (!allocationsMatch(expense.allocations, expectedAllocations)) {
    throw new FinancialDomainError('Las asignaciones guardadas no coinciden con el reparto canónico del gasto.')
  }

  return expense.allocations
}

/** Total aportado por una persona a partir de sus movimientos reales. */
export function calculateTotalContributedByPerson(
  personId: PersonId,
  contributions: readonly Contribution[],
): AmountInCents {
  return sumAmounts(
    contributions
      .filter((contribution) => contribution.personId === personId)
      .map((contribution) => {
        assertSignedAmountInCents(contribution.amountInCents, 'El importe de una aportación')
        return contribution.amountInCents
      }),
  )
}

/** Parte de gastos que corresponde a una persona dentro de un grupo. */
export function calculateTotalSpentByPerson(
  personId: PersonId,
  groupId: GroupId,
  expenses: readonly Expense[],
): AmountInCents {
  return sumAmounts(
    expenses
      .filter((expense) => expense.groupId === groupId)
      .flatMap((expense) => getConsistentAllocations(expense))
      .filter((allocation) => allocation.personId === personId)
      .map((allocation) => allocation.amountInCents),
  )
}

/** Saldo derivado de aportaciones menos gasto asignado de una persona. */
export function calculatePersonBalance(
  personId: PersonId,
  groupId: GroupId,
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
): PersonBalance {
  const contributedInCents = calculateTotalContributedByPerson(
    personId,
    contributions.filter((contribution) => contribution.groupId === groupId),
  )
  const spentInCents = calculateTotalSpentByPerson(personId, groupId, expenses)

  return {
    personId,
    contributedInCents,
    spentInCents,
    availableInCents: contributedInCents - spentInCents,
  }
}

/** Saldo del monedero: aportaciones del grupo menos gastos del grupo. */
export function calculateGroupBalance(
  groupId: GroupId,
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
): GroupBalance {
  const contributedInCents = sumAmounts(
    contributions
      .filter((contribution) => contribution.groupId === groupId)
      .map((contribution) => {
        assertSignedAmountInCents(contribution.amountInCents, 'El importe de una aportación')
        return contribution.amountInCents
      }),
  )
  const spentInCents = sumAmounts(
    expenses
      .filter((expense) => expense.groupId === groupId)
      .map((expense) => {
        getConsistentAllocations(expense)
        return expense.totalInCents
      }),
  )

  return {
    groupId,
    contributedInCents,
    spentInCents,
    availableInCents: contributedInCents - spentInCents,
  }
}

/** Saldos de todos los grupos y total global de monederos. */
export function calculateGlobalBalance(
  groups: readonly Group[],
  contributions: readonly Contribution[],
  expenses: readonly Expense[],
): GlobalBalance {
  const balances = groups.map((group) => calculateGroupBalance(group.id, contributions, expenses))

  return {
    groups: balances,
    availableInCents: sumAmounts(balances.map((balance) => balance.availableInCents)),
  }
}

/** Comprueba que el reparto guardado es el reparto canónico y suma el total. */
export function checkExpenseIntegrity(expense: Expense): FinancialIntegrityCheck {
  try {
    const expectedAllocations = calculateExpenseAllocations(expense)
    const isConsistent =
      sumAmounts(expense.allocations.map((allocation) => allocation.amountInCents)) === expense.totalInCents &&
      allocationsMatch(expense.allocations, expectedAllocations)

    return { scope: 'expense', isConsistent }
  } catch {
    return { scope: 'expense', isConsistent: false }
  }
}

/** Comprueba la identidad aportado − consumido = saldo personal. */
export function checkPersonIntegrity(balance: PersonBalance): FinancialIntegrityCheck {
  return {
    scope: 'person',
    isConsistent: balance.contributedInCents - balance.spentInCents === balance.availableInCents,
  }
}

/** Comprueba el saldo de grupo y su coincidencia con los saldos personales. */
export function checkGroupIntegrity(
  balance: GroupBalance,
  personBalances: readonly PersonBalance[],
): FinancialIntegrityCheck {
  const balancesMatchGroup =
    sumAmounts(personBalances.map((personBalance) => personBalance.availableInCents)) === balance.availableInCents

  return {
    scope: 'group',
    isConsistent:
      balance.contributedInCents - balance.spentInCents === balance.availableInCents && balancesMatchGroup,
  }
}

/** Comprueba que el total global coincide con la suma de grupos. */
export function checkGlobalIntegrity(balance: GlobalBalance): FinancialIntegrityCheck {
  return {
    scope: 'global',
    isConsistent:
      sumAmounts(balance.groups.map((groupBalance) => groupBalance.availableInCents)) ===
      balance.availableInCents,
  }
}
