import type { Contribution, ContributionId, GroupId } from '../../domain/entities'

export class ProSummaryContributionActionError extends Error {}

/** Las aperturas V3 son contexto heredado y nunca se modifican desde Resumen PRO. */
export function getManageableProSummaryContribution(
  contributions: readonly Contribution[],
  groupId: GroupId,
  contributionId: ContributionId,
): Contribution {
  const contribution = contributions.find(
    (candidate) => candidate.id === contributionId && candidate.groupId === groupId,
  )

  if (contribution === undefined) {
    throw new ProSummaryContributionActionError('La aportación no pertenece al grupo activo.')
  }

  if (contribution.source === 'v3-opening' || contribution.date === null) {
    throw new ProSummaryContributionActionError('La aportación de Inicio heredada no se puede gestionar.')
  }

  return contribution
}
