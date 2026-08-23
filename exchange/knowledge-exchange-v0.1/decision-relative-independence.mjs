const CUT_FIELDS = Object.freeze({
  provenance_root: "provenanceRootId",
  signed_node: "nodeId",
  participant: "participantId",
  controller_group: "controllerGroupId",
});
const CUT_SELECTION_BASES = new Set(["preregistered", "rules-engine", "model-selected", "human-reviewed", "declared", "unknown"]);

export const DECISION_RELATIVE_CUTS = Object.freeze(Object.keys(CUT_FIELDS));

function requireText(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required`);
  return value.trim();
}

function latestAtCut(observations, cut) {
  const field = CUT_FIELDS[cut];
  if (!field) throw new TypeError(`unsupported independence cut: ${cut}`);
  const latest = new Map();
  const conflictedRoots = new Set();
  let unknownObservationCount = 0;
  for (const observation of observations) {
    const root = observation?.[field];
    if (typeof root !== "string" || !root.trim()) {
      unknownObservationCount += 1;
      continue;
    }
    const outcome = observation.outcome;
    if (!new Set(["success", "failure"]).has(outcome)) throw new TypeError("outcome must be success or failure");
    const observedAt = Date.parse(observation.observedAt);
    if (!Number.isFinite(observedAt)) throw new TypeError("observedAt must be an ISO-8601 timestamp");
    const key = root.trim();
    const prior = latest.get(key);
    if (!prior || observedAt > prior.observedAt) {
      latest.set(key, { root: key, outcome, observedAt });
      conflictedRoots.delete(key);
    } else if (observedAt === prior.observedAt && outcome !== prior.outcome) {
      conflictedRoots.add(key);
    }
  }
  return { latest, conflictedRoots, unknownObservationCount };
}

export function accountAtIndependenceCut(observations, cut) {
  if (!Array.isArray(observations)) throw new TypeError("observations must be an array");
  const { latest, conflictedRoots, unknownObservationCount } = latestAtCut(observations, cut);
  const usable = [...latest.values()].filter(({ root }) => !conflictedRoots.has(root));
  const supportingRoots = usable.filter(({ outcome }) => outcome === "success").map(({ root }) => root).sort();
  const opposingRoots = usable.filter(({ outcome }) => outcome === "failure").map(({ root }) => root).sort();
  return {
    independenceCut: cut,
    distinctRootCount: usable.length,
    supportingRootCount: supportingRoots.length,
    opposingRootCount: opposingRoots.length,
    unknownObservationCount,
    conflictedRoots: [...conflictedRoots].sort(),
    supportingRoots,
    opposingRoots,
  };
}

export function accountAtAllCuts(observations) {
  return Object.fromEntries(DECISION_RELATIVE_CUTS.map((cut) => [cut, accountAtIndependenceCut(observations, cut)]));
}

function countFingerprint(result) {
  return JSON.stringify([
    result.distinctRootCount,
    result.supportingRootCount,
    result.opposingRootCount,
    result.unknownObservationCount,
    result.conflictedRoots,
  ]);
}

export function assessDeclaredIndependenceCut(observations, policy) {
  const decisionId = requireText(policy?.decisionId, "decisionId");
  const failureDomain = requireText(policy?.failureDomain, "failureDomain");
  const independenceCut = requireText(policy?.independenceCut, "independenceCut");
  const cutSelectionBasis = requireText(policy?.cutSelectionBasis, "cutSelectionBasis");
  if (!CUT_FIELDS[independenceCut]) throw new TypeError(`unsupported independence cut: ${independenceCut}`);
  if (!CUT_SELECTION_BASES.has(cutSelectionBasis)) throw new TypeError("unsupported cutSelectionBasis");
  if (!Number.isInteger(policy.minimumSupportingRoots) || policy.minimumSupportingRoots < 1) {
    throw new TypeError("minimumSupportingRoots must be a positive integer");
  }
  const candidateCuts = [...new Set([independenceCut, ...(policy.candidateCuts ?? [])])];
  for (const cut of candidateCuts) if (!CUT_FIELDS[cut]) throw new TypeError(`unsupported independence cut: ${cut}`);
  const accounting = Object.fromEntries(candidateCuts.map((cut) => [cut, accountAtIndependenceCut(observations, cut)]));
  const selected = accounting[independenceCut];
  const supportSatisfied = selected.supportingRootCount >= policy.minimumSupportingRoots
    && selected.conflictedRoots.length === 0;
  const alternatives = Object.fromEntries(candidateCuts.filter((cut) => cut !== independenceCut).map((cut) => {
    const result = accounting[cut];
    return [cut, {
      ...result,
      supportSatisfied: result.supportingRootCount >= policy.minimumSupportingRoots
        && result.conflictedRoots.length === 0,
    }];
  }));
  return {
    schema: "agentwex.decision-relative-independence.v0.1",
    decisionId,
    failureDomain,
    independenceCut,
    cutSelectionBasis,
    minimumSupportingRoots: policy.minimumSupportingRoots,
    selected: { ...selected, supportSatisfied },
    alternatives,
    materialAlternativeCuts: Object.entries(alternatives)
      .filter(([, result]) => result.supportSatisfied !== supportSatisfied)
      .map(([cut]) => cut),
    countSensitiveCuts: Object.entries(alternatives)
      .filter(([, result]) => result.supportSatisfied === supportSatisfied
        && countFingerprint(result) !== countFingerprint(selected))
      .map(([cut]) => cut),
    boundaries: {
      policyInferred: false,
      controllerIndependenceVerified: false,
      actionAuthorityGranted: false,
      fullLineageMutated: false,
    },
  };
}
