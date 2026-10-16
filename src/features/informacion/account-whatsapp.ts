export function normalizeWhatsAppPhone(phone: string): string | null {
  const rawPhone = phone.trim().replace(/[^\d]/g, '')
  const destinationPhone = rawPhone.length === 9 ? `34${rawPhone}` : rawPhone

  return /^\d{8,15}$/.test(destinationPhone) ? destinationPhone : null
}

export function createWhatsAppUrl(phone: string, message: string): string | null {
  const destinationPhone = normalizeWhatsAppPhone(phone)
  return destinationPhone === null
    ? null
    : `https://wa.me/${destinationPhone}?text=${encodeURIComponent(message)}`
}

export function createPendingBalanceWhatsAppUrl(
  name: string,
  phone: string,
  pendingAmountInCents: number,
  groupName: string,
): string | null {
  if (pendingAmountInCents >= 0) return null
  const absoluteAmount = Math.abs(pendingAmountInCents)
  const amount = `${Math.floor(absoluteAmount / 100)},${String(absoluteAmount % 100).padStart(2, '0')} €`
  const message = `Hola ${name}, tienes pendiente ${amount} en ${groupName}.`
  return createWhatsAppUrl(phone, message)
}
