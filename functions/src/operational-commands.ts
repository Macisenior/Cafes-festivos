import { addCashContribution, ContributionDomainError, type NewContributionInput } from '../../src/domain/contributions'
import type { Contribution, Expense, Group, Person } from '../../src/domain/entities'
import { createExpense, ExpenseDomainError, type NewExpenseInput } from '../../src/domain/expenses'

export class OperationalAuthorizationError extends Error {}
export class OperationalRequestError extends Error {}

export interface OperationalGroupSnapshot {
  group: Group
  people: readonly Person[]
  contributions: readonly Contribution[]
  expenses: readonly Expense[]
}

export interface OperationalWritePort {
  readGroup(groupId: string): Promise<OperationalGroupSnapshot>
  createContribution(contribution: Contribution): Promise<void>
  createExpense(expense: Expense): Promise<void>
}

export interface OperationalContributionCommand {
  pin: unknown
  input: NewContributionInput
}

export interface OperationalExpenseCommand {
  pin: unknown
  input: NewExpenseInput
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OperationalRequestError(`${label} es obligatorio.`)
  }
}

export function assertOperationalPin(receivedPin: unknown, expectedPin: string): void {
  assertNonEmptyString(expectedPin, 'El PIN operativo del servidor')
  if (typeof receivedPin !== 'string' || receivedPin !== expectedPin) {
    throw new OperationalAuthorizationError('El PIN operativo no es válido.')
  }
}

function assertGroupId(value: unknown): asserts value is string {
  assertNonEmptyString(value, 'El identificador de grupo')
  if (value.includes('/')) throw new OperationalRequestError('El identificador de grupo no puede ser una ruta.')
}

/** Ejecuta la misma regla de dominio que Añadir efectivo antes de persistir un único movimiento V4. */
export async function createCashContributionCommand(
  command: OperationalContributionCommand,
  expectedPin: string,
  writes: OperationalWritePort,
): Promise<Contribution> {
  assertOperationalPin(command.pin, expectedPin)
  assertGroupId(command.input?.groupId)

  const snapshot = await writes.readGroup(command.input.groupId)
  const contribution = addCashContribution(snapshot.people, snapshot.contributions, command.input)
  await writes.createContribution(contribution)
  return contribution
}

/** Construye el gasto y sus asignaciones exclusivamente con el dominio financiero V4. */
export async function createExpenseCommand(
  command: OperationalExpenseCommand,
  expectedPin: string,
  writes: OperationalWritePort,
): Promise<Expense> {
  assertOperationalPin(command.pin, expectedPin)
  assertGroupId(command.input?.groupId)

  const snapshot = await writes.readGroup(command.input.groupId)
  const expense = createExpense(snapshot.group, snapshot.people, snapshot.expenses, command.input)
  await writes.createExpense(expense)
  return expense
}

export function isOperationalDomainError(error: unknown): error is ContributionDomainError | ExpenseDomainError | OperationalRequestError {
  return error instanceof ContributionDomainError || error instanceof ExpenseDomainError || error instanceof OperationalRequestError
}
