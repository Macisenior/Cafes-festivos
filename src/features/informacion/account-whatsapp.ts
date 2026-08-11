export function createPendingBalanceWhatsAppUrl(
  name: string,
  phone: string,
  pendingAmountInCents: number,
  groupName: string,
): string | null {
  const rawPhone = phone.trim().replace(/[^\d]/g, '')
  if (rawPhone.length < 7 || pendingAmountInCents >= 0) return null
  const destinationPhone = rawPhone.length === 9 ? `34${rawPhone}` : rawPhone
  const absoluteAmount = Math.abs(pendingAmountInCents)
  const amount = `${Math.floor(absoluteAmount / 100)},${String(absoluteAmount % 100).padStart(2, '0')} €`
  const message = `Hola ${name}, tienes pendiente ${amount} en ${groupName}.`
  return `https://wa.me/${destinationPhone}?text=${encodeURIComponent(message)}`
}
