/**
 * Destino único del aviso de Gasto rápido. Configurar exclusivamente como
 * 34 + nueve dígitos españoles, sin espacios ni símbolos, mediante
 * VITE_QUICK_EXPENSE_WHATSAPP_PHONE (por ejemplo: 34600123456).
 */
export const quickExpenseConfig = {
  whatsAppRecipientPhone: import.meta.env.VITE_QUICK_EXPENSE_WHATSAPP_PHONE ?? '',
} as const

/** Devuelve el teléfono apto para wa.me o null si no tiene el formato español requerido. */
export function configuredQuickExpenseRecipient(phone = quickExpenseConfig.whatsAppRecipientPhone): string | null {
  return /^34\d{9}$/.test(phone) ? phone : null
}