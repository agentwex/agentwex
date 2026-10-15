const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const CELL_FIELDS = ["toolRegistry", "toolId", "toolVersion", "clientId", "clientVersion", "environment", "authMode", "operation"];

const boundedText = (value, maximum = 120) => typeof value === "string" ? value.slice(0, maximum) : null;

export function localOutcomeFromReceipt(receipt) {
  return {
    toolRegistry: receipt.toolRegistry,
    toolId: receipt.toolId,
    toolVersion: receipt.toolVersion,
    clientId: receipt.clientId,
    clientVersion: receipt.clientVersion,
    environment: receipt.environment,
    authMode: receipt.authMode,
    operation: receipt.operation,
    capabilityId: receipt.capabilityId ?? null,
    effectClass: receipt.effectClass ?? null,
    outcome: receipt.outcome,
    errorClass: boundedText(receipt.errorClass),
    resolutionKind: receipt.resolutionKind ?? "none",
    observedAt: receipt.observedAt,
  };
}

export function rememberLocalOutcome(outcomes, receipt, limit = 250) {
  const next = localOutcomeFromReceipt(receipt);
  const existing = Array.isArray(outcomes) ? outcomes : [];
  const key = JSON.stringify(next);
  return [next, ...existing.filter((entry) => JSON.stringify(entry) !== key)]
    .toSorted((left, right) => String(right.observedAt ?? "").localeCompare(String(left.observedAt ?? "")))
    .slice(0, Math.max(1, limit));
}

function exactCellMatch(outcome, query) {
  if (!CELL_FIELDS.every((field) => outcome?.[field] === query?.[field])) return false;
  if (query.capabilityId != null && outcome.capabilityId !== query.capabilityId) return false;
  if (query.effectClass != null && outcome.effectClass !== query.effectClass) return false;
  return true;
}

export function assessLocalRecall(outcomes, query, evaluatedAt = new Date().toISOString()) {
  const evaluated = Date.parse(evaluatedAt);
  const maximumAgeDays = Number.isInteger(query?.maxAgeDays) ? query.maxAgeDays : 7;
  const cutoff = evaluated - (maximumAgeDays * DAY_MS);
  const matches = (Array.isArray(outcomes) ? outcomes : [])
    .filter((outcome) => exactCellMatch(outcome, query))
    .filter((outcome) => {
      const observed = Date.parse(outcome.observedAt);
      return Number.isFinite(observed) && Number.isFinite(evaluated) && observed >= cutoff && observed <= evaluated;
    })
    .toSorted((left, right) => right.observedAt.localeCompare(left.observedAt));
  const successes = matches.filter((outcome) => outcome.outcome === "success");
  const failures = matches.filter((outcome) => outcome.outcome === "failure");
  const newest = matches[0] ?? null;
  const freshnessHours = newest
    ? Number(((evaluated - Date.parse(newest.observedAt)) / HOUR_MS).toFixed(2))
    : null;
  const failureCounts = new Map();
  for (const failure of failures) {
    const errorClass = failure.errorClass ?? "other";
    failureCounts.set(errorClass, (failureCounts.get(errorClass) ?? 0) + 1);
  }
  return {
    source: "private-local-history",
    sampleCount: matches.length,
    successCount: successes.length,
    failureCount: failures.length,
    successRate: matches.length ? Number((successes.length / matches.length).toFixed(4)) : null,
    lastObservedAt: newest?.observedAt ?? null,
    freshnessHours,
    freshness: freshnessHours == null ? "none" : freshnessHours <= 24 ? "fresh" : freshnessHours <= 168 ? "current" : "stale",
    topFailureClasses: [...failureCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([errorClass, count]) => ({ errorClass, count })),
    establishesNetworkSupport: false,
    creditEligible: false,
    authorityGranted: false,
  };
}
