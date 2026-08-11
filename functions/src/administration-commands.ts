import { createPersonWithOptionalInitialContribution, deactivatePerson, deletePerson, editPerson, reactivatePerson } from '../../src/domain/persons'
import { assertGroupCanBeDeleted, createStandardGroup, editGroupName } from '../../src/domain/groups'
import { deleteContribution, editContribution, isValidHistoricalContribution } from '../../src/domain/contributions'
import { editExpense } from '../../src/domain/expenses'
import type { Contribution, Expense, Group, Person } from '../../src/domain/entities'
import type { GroupFinancialEntities } from '../../src/domain/financial-adapter'

export class AdministrationAuthorizationError extends Error {}
export class AdministrationRequestError extends Error {}

export type AdministrationAction =
  | 'createPerson' | 'editPerson' | 'deactivatePerson' | 'reactivatePerson' | 'deletePerson'
  | 'createGroup' | 'editGroupName' | 'deleteEmptyGroup'
  | 'editExpense' | 'deleteExpense'
  | 'editContribution' | 'deleteContribution'

export interface AdministrationCommand {
  pin: unknown
  action: AdministrationAction
  groupId: string
  payload: Record<string, unknown>
}

export interface AdministrationPort {
  listGroups(): Promise<readonly Group[]>
  readGroup(groupId: string): Promise<GroupFinancialEntities>
  createGroup(group: Group): Promise<void>
  updateGroupName(groupId: string, name: string): Promise<void>
  deleteGroup(groupId: string): Promise<void>
  createPerson(person: Person, contribution?: Contribution): Promise<void>
  updatePerson(person: Person): Promise<void>
  deletePerson(groupId: string, personId: string): Promise<void>
  updateExpense(expense: Expense): Promise<void>
  deleteExpense(groupId: string, expenseId: string): Promise<void>
  updateContribution(contribution: Contribution): Promise<void>
  deleteContribution(groupId: string, contributionId: string): Promise<void>
}

function assertPin(received: unknown, expected: string): void {
  if (typeof received !== 'string' || received !== expected) {
    throw new AdministrationAuthorizationError('El PIN de Administración no es válido.')
  }
}

function assertId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('/')) {
    throw new AdministrationRequestError(`${label} no es válido.`)
  }
}

function value<T>(payload: Record<string, unknown>, name: string): T {
  return payload[name] as T
}

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AdministrationRequestError('La solicitud administrativa no es válida.')
  }
}

export function assertAdministrationPin(receivedPin: unknown, expectedPin: string): void {
  if (typeof expectedPin !== 'string' || expectedPin.trim() === '') {
    throw new AdministrationRequestError('El PIN administrativo del servidor no está configurado.')
  }
  assertPin(receivedPin, expectedPin)
}

/** Ejecuta una única mutación administrativa usando las reglas de dominio V4 existentes. */
export async function executeAdministrationCommand(
  command: AdministrationCommand,
  expectedPin: string,
  port: AdministrationPort,
): Promise<unknown> {
  assertAdministrationPin(command.pin, expectedPin)
  assertId(command.groupId, 'El grupo')
  assertRecord(command.payload)

  if (command.action === 'createGroup') {
    const group = createStandardGroup(await port.listGroups(), value(command.payload, 'input'))
    assertId(group.id, 'El identificador del grupo')
    await port.createGroup(group)
    return group
  }

  if (command.action === 'editGroupName') {
    const group = editGroupName(await port.listGroups(), command.groupId, value(command.payload, 'name'))
    await port.updateGroupName(group.id, group.name)
    return group
  }

  const entities = await port.readGroup(command.groupId)
  switch (command.action) {
    case 'createPerson': {
      const created = createPersonWithOptionalInitialContribution(entities.people, entities.contributions, value(command.payload, 'request'))
      assertId(created.person.id, 'La persona')
      if (created.initialContribution) assertId(created.initialContribution.id, 'La aportación')
      await port.createPerson(created.person, created.initialContribution)
      return created
    }
    case 'editPerson': {
      const person = editPerson(entities.people, command.groupId, value(command.payload, 'edition'))
      assertId(person.id, 'La persona')
      await port.updatePerson(person)
      return person
    }
    case 'deactivatePerson': {
      const person = deactivatePerson(entities.people, command.groupId, value(command.payload, 'personId'))
      assertId(person.id, 'La persona')
      await port.updatePerson(person)
      return person
    }
    case 'reactivatePerson': {
      const person = reactivatePerson(entities.people, command.groupId, value(command.payload, 'personId'))
      assertId(person.id, 'La persona')
      await port.updatePerson(person)
      return person
    }
    case 'deletePerson': {
      const personId = value<string>(command.payload, 'personId')
      assertId(personId, 'La persona')
      deletePerson(entities.people, entities.contributions, entities.expenses, command.groupId, personId)
      await port.deletePerson(command.groupId, personId)
      return null
    }
    case 'deleteEmptyGroup': {
      assertGroupCanBeDeleted(entities, value(command.payload, 'activeGroupId'))
      await port.deleteGroup(command.groupId)
      return null
    }
    case 'editExpense': {
      const expense = editExpense(entities.group, entities.people, entities.expenses, value(command.payload, 'expenseId'), value(command.payload, 'input'))
      assertId(expense.id, 'El gasto')
      await port.updateExpense(expense)
      return expense
    }
    case 'deleteExpense': {
      const expenseId = value<string>(command.payload, 'expenseId')
      assertId(expenseId, 'El gasto')
      const expense = entities.expenses.find((item) => item.id === expenseId && item.groupId === command.groupId)
      if (!expense) throw new AdministrationRequestError('El gasto no pertenece al grupo activo.')
      await port.deleteExpense(command.groupId, expenseId)
      return null
    }
    case 'editContribution': {
      const edition = value<{ id: string; amountInCents: number; date: string }>(command.payload, 'edition')
      assertId(edition?.id, 'La aportación')
      const contribution = entities.contributions.find((item) => item.id === edition.id)
      if (!contribution || contribution.groupId !== command.groupId || isValidHistoricalContribution(contribution)) {
        throw new AdministrationRequestError('La aportación no se puede editar.')
      }
      const updated = editContribution(entities.contributions, edition).find((item) => item.id === edition.id)
      if (!updated) throw new AdministrationRequestError('No existe la aportación solicitada.')
      await port.updateContribution(updated)
      return updated
    }
    case 'deleteContribution': {
      const contributionId = value<string>(command.payload, 'contributionId')
      assertId(contributionId, 'La aportación')
      const contribution = entities.contributions.find((item) => item.id === contributionId)
      if (!contribution || contribution.groupId !== command.groupId || isValidHistoricalContribution(contribution)) {
        throw new AdministrationRequestError('La aportación no se puede borrar.')
      }
      deleteContribution(entities.contributions, contributionId)
      await port.deleteContribution(command.groupId, contributionId)
      return null
    }
  }
}
