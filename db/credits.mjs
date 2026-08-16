export function creditsForAcceptedContribution({ accepted, independentlyAdditive, freshnessDays }) {
  if (accepted !== true || independentlyAdditive !== true) return 0;
  if (!Number.isInteger(freshnessDays) || freshnessDays < 0) return 0;
  return freshnessDays <= 30 ? 2 : 1;
}
