/** Estado de despliegue de interfaz; no altera el informe financiero recibido. */
export function toggleProSummaryDetail(expandedPersonIds: readonly string[], personId: string): readonly string[] {
  return expandedPersonIds.includes(personId)
    ? expandedPersonIds.filter((id) => id !== personId)
    : [...expandedPersonIds, personId]
}
