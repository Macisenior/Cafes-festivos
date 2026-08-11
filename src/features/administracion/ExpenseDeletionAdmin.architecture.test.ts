/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ExpenseDeletionAdmin.tsx', import.meta.url)), 'utf8')

describe('presentación administrativa de gastos', () => {
  it('ofrece vista compacta, detalle de solo lectura y el selector mes actual/todos', () => {
    expect(source).toContain('Ver detalle')
    expect(source).toContain('expense-detail-modal')
    expect(source).toContain("'current-month'")
    expect(source).toContain('Ver todos los gastos')
    expect(source).toContain('Ver mes actual')
  })

  it('inserta el único editor existente justo después de la tarjeta seleccionada', () => {
    expect(source).toContain('<Fragment key={expense.id}>')
    expect(source).toContain("editingExpense?.id === expense.id")
    expect(source).toContain('admin-expense-inline-editor')
    expect(source).not.toContain('{editingExpense && (')
  })
  it('muestra asignaciones almacenadas sin recalcular el reparto y conserva Editar/Eliminar', () => {
    expect(source).toContain('expenseAllocationDetails(viewingExpense, people)')
    expect(source).not.toContain('createExpense')
    expect(source).toContain('Editar')
    expect(source).toContain('Eliminar')
  })
})
