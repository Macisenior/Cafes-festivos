import { describe, expect, it } from 'vitest'
import { createPersonRequest, PersonCreateFormError } from './person-create-request'
import { createAdministrationPeopleList } from './people-list'

const input = {
  personId: 'pepe',
  contributionId: 'opening-pepe',
  groupId: 'general',
  name: 'Pepe',
  phone: '600000000',
  initialContributionInEuros: '',
  date: '2026-08-10',
}

describe('preparación del alta de persona', () => {
  it('prepara un alta sin aportación inicial', () => {
    expect(createPersonRequest(input)).toEqual({
      person: { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '600000000' },
    })
  })

  it('prepara un alta con aportación inicial en céntimos', () => {
    expect(createPersonRequest({ ...input, initialContributionInEuros: '20,50' })).toEqual({
      person: { id: 'pepe', groupId: 'general', name: 'Pepe', phone: '600000000' },
      initialContribution: {
        id: 'opening-pepe', groupId: 'general', personId: 'pepe', amountInCents: 2050, date: '2026-08-10',
      },
    })
  })

  it('rechaza un nombre vacío y un importe inicial no válido', () => {
    expect(() => createPersonRequest({ ...input, name: '  ' })).toThrow(PersonCreateFormError)
    expect(() => createPersonRequest({ ...input, initialContributionInEuros: '-1' })).toThrow('importe positivo válido')
    expect(() => createPersonRequest({ ...input, initialContributionInEuros: '0' })).toThrow('importe positivo válido')
  })

  it('produce una persona que aparece en el listado tras una recarga válida', () => {
    const request = createPersonRequest(input)
    const peopleAfterReload = [{ ...request.person, isActive: true }]

    expect(createAdministrationPeopleList('general', peopleAfterReload))
      .toEqual([{ id: 'pepe', name: 'Pepe', phone: '600000000', isActive: true }])
  })
})
