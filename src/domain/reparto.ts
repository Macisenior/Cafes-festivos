import type { AmountInCents } from './money'

/** Identificador estable de una persona participante. */
export type PersonId = string

/** Los tres métodos de reparto establecidos para V4. */
export type ExpenseDistributionMode = 'igual' | 'consumiciones' | 'importe'

/** Importe final que corresponde a una persona dentro de un gasto. */
export interface ExpenseAllocation {
  personId: PersonId
  amountInCents: AmountInCents
}

/** Configuración del reparto igualitario. */
export interface EqualDistribution {
  mode: 'igual'
}

/** Cantidades de consumiciones usadas para explicar el reparto proporcional. */
export interface ConsumptionsDistribution {
  mode: 'consumiciones'
  consumptionsByPersonId: Readonly<Record<PersonId, number>>
}

/** Importes indicados manualmente por persona antes de guardar el gasto. */
export interface IndividualAmountDistribution {
  mode: 'importe'
  amountsByPersonId: Readonly<Record<PersonId, AmountInCents>>
}

/** Configuración de origen del reparto, sin lógica de cálculo asociada. */
export type ExpenseDistribution =
  | EqualDistribution
  | ConsumptionsDistribution
  | IndividualAmountDistribution
