import type { CreatePersonRequest } from '../../domain/persons'
import type { GroupId } from '../../domain/entities'
import { eurosToCents } from '../aportaciones/cash-contribution-request'

export class PersonCreateFormError extends Error {}

export interface PersonCreateFormInput {
  personId: string
  contributionId: string
  groupId: GroupId
  name: string
  phone: string
  initialContributionInEuros: string
  date: string
}

/** Prepara el alta; si el importe está vacío no se crea ningún movimiento. */
export function createPersonRequest(input: PersonCreateFormInput): CreatePersonRequest {
  const name = input.name.trim()
  if (name.length === 0) throw new PersonCreateFormError('El nombre de la persona es obligatorio.')

  const request: CreatePersonRequest = {
    person: {
      id: input.personId,
      groupId: input.groupId,
      name,
      phone: input.phone.trim(),
    },
  }

  if (input.initialContributionInEuros.trim() === '') return request

  request.initialContribution = {
    id: input.contributionId,
    groupId: input.groupId,
    personId: input.personId,
    amountInCents: eurosToCents(input.initialContributionInEuros),
    date: input.date,
  }
  return request
}

export function resetPersonCreateForm(): { name: string; phone: string; initialContributionInEuros: string } {
  return { name: '', phone: '', initialContributionInEuros: '' }
}
