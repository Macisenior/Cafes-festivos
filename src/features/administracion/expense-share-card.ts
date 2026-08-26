import type { Expense, Person } from '../../domain/entities'
import { expenseAllocationDetails, expenseDistributionLabel, type ExpenseAllocationDetail } from './admin-expense-list'
import { formatPdfDate, formatPdfMoney } from './historical-pdf'

export interface ExpenseShareCardData {
  groupName: string
  siteName: string
  concept: string
  formattedDate: string
  formattedTotal: string
  distributionLabel: string
  allocations: readonly ExpenseAllocationDetail[]
}

/** Prepara solo la información existente del gasto para la tarjeta visual de compartición. */
export function createExpenseShareCardData(
  groupName: string,
  expense: Expense,
  people: readonly Person[],
): ExpenseShareCardData {
  return {
    groupName,
    siteName: expense.siteName,
    concept: expense.concept,
    formattedDate: formatPdfDate(expense.date),
    formattedTotal: formatPdfMoney(expense.totalInCents),
    distributionLabel: expenseDistributionLabel(expense.distribution.mode),
    allocations: expenseAllocationDetails(expense, people),
  }
}