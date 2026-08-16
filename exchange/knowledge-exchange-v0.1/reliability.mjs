const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const nodeKey = (record) => record.agentId ?? `legacy:${record.provenanceRootId}`;
const routeKey = (record) => [
  record.toolVersion,
  record.clientVersion,
  record.environment,
  record.authMode,
  record.resolutionKind,
  record.routeFingerprint,
].join("|");

function latestNodeOutcomes(records, from, until) {
  const latest = new Map();
  for (const record of records) {
    const observed = Date.parse(record.observedAt);
    if (!Number.isFinite(observed) || observed < from || observed >= until) continue;
    const key = nodeKey(record);
    const prior = latest.get(key);
    if (!prior || record.observedAt > prior.observedAt) latest.set(key, record);
  }
  return [...latest.values()];
}

function summarize(records, from, until, evaluatedAt) {
  const outcomes = latestNodeOutcomes(records, from, until);
  const successes = outcomes.filter((record) => record.outcome === "success");
  const failures = outcomes.filter((record) => record.outcome === "failure");
  const newest = outcomes.toSorted((left, right) => right.observedAt.localeCompare(left.observedAt))[0];
  const errorCounts = new Map();
  for (const failure of failures) {
    const key = failure.errorClass ?? "other";
    errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
  }
  return {
    distinctSignedNodeCount: outcomes.length,
    successfulNodeCount: successes.length,
    failedNodeCount: failures.length,
    successRate: outcomes.length ? Number((successes.length / outcomes.length).toFixed(4)) : null,
    lastObservedAt: newest?.observedAt ?? null,
    freshnessHours: newest ? Number(((Date.parse(evaluatedAt) - Date.parse(newest.observedAt)) / HOUR_MS).toFixed(2)) : null,
    topFailureClasses: [...errorCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([errorClass, count]) => ({ errorClass, count })),
  };
}

function confidenceFor(summary) {
  const count = summary.distinctSignedNodeCount;
  const densityLevel = count < 2 ? "insufficient" : count < 5 ? "low" : count < 10 ? "medium" : "high";
  const freshnessCeiling = summary.freshnessHours == null || summary.freshnessHours > 72
    ? "low"
    : summary.freshnessHours > 24
      ? "medium"
      : "high";
  const levels = ["insufficient", "low", "medium", "high"];
  const level = levels[Math.min(levels.indexOf(densityLevel), levels.indexOf(freshnessCeiling))];
  return {
    level,
    distinctSignedNodeCount: count,
    basis: "Heuristic evidence density and freshness; not a statistical guarantee or controller-independence proof.",
  };
}

function candidateRoutes(records, feedback, cutoff, evaluatedAt, minimumSignedNodes) {
  const evaluated = Date.parse(evaluatedAt);
  const routes = new Map();
  for (const record of records) {
    const observed = Date.parse(record.observedAt);
    if (!Number.isFinite(observed) || observed < cutoff || observed > evaluated) continue;
    const key = routeKey(record);
    const route = routes.get(key) ?? { key, latestByNode: new Map() };
    const node = nodeKey(record);
    const prior = route.latestByNode.get(node);
    if (!prior || record.observedAt > prior.observedAt) route.latestByNode.set(node, record);
    routes.set(key, route);
  }
  const feedbackByFingerprint = new Map();
  for (const item of feedback) {
    const created = item.createdAt == null ? null : Date.parse(item.createdAt);
    if (created != null && (!Number.isFinite(created) || created < cutoff || created > evaluated)) continue;
    const summary = feedbackByFingerprint.get(item.routeFingerprint) ?? {
      succeeded: 0, failed: 0, notAttempted: 0, attemptsAvoided: 0,
      estimatedTokensAvoided: 0, estimatedLatencyMsAvoided: 0,
    };
    if (item.outcome === "succeeded") summary.succeeded += 1;
    else if (item.outcome === "failed") summary.failed += 1;
    else summary.notAttempted += 1;
    summary.attemptsAvoided += Number(item.attemptsAvoided ?? 0);
    summary.estimatedTokensAvoided += Number(item.estimatedTokensAvoided ?? 0);
    summary.estimatedLatencyMsAvoided += Number(item.estimatedLatencyMsAvoided ?? 0);
    feedbackByFingerprint.set(item.routeFingerprint, summary);
  }
  return [...routes.values()].map((route) => {
    const observations = [...route.latestByNode.values()]
      .filter((record) => record.outcome === "success")
      .toSorted((left, right) => right.observedAt.localeCompare(left.observedAt));
    if (observations.length === 0) return null;
    const first = observations[0];
    const outcomes = feedbackByFingerprint.get(first.routeFingerprint) ?? {
      succeeded: 0, failed: 0, notAttempted: 0, attemptsAvoided: 0,
      estimatedTokensAvoided: 0, estimatedLatencyMsAvoided: 0,
    };
    const attemptedFeedback = outcomes.succeeded + outcomes.failed;
    return {
      toolVersion: first.toolVersion,
      clientVersion: first.clientVersion,
      environment: first.environment,
      authMode: first.authMode,
      resolutionKind: first.resolutionKind,
      routeFingerprint: first.routeFingerprint,
      distinctSignedNodeCount: observations.length,
      supported: observations.length >= minimumSignedNodes,
      lastObservedAt: first.observedAt,
      freshnessHours: Number(((Date.parse(evaluatedAt) - Date.parse(first.observedAt)) / HOUR_MS).toFixed(2)),
      feedback: {
        ...outcomes,
        successRate: attemptedFeedback ? Number((outcomes.succeeded / attemptedFeedback).toFixed(4)) : null,
      },
      controllerIndependenceVerified: false,
      executionTruthVerified: false,
    };
  }).filter(Boolean).sort((left, right) =>
    Number(right.supported) - Number(left.supported)
    || right.distinctSignedNodeCount - left.distinctSignedNodeCount
    || (right.feedback.succeeded - right.feedback.failed) - (left.feedback.succeeded - left.feedback.failed)
    || right.lastObservedAt.localeCompare(left.lastObservedAt));
}

export function evaluatePreflight(records, feedback, input, evaluatedAt = new Date().toISOString()) {
  const evaluated = Date.parse(evaluatedAt);
  const cutoff = evaluated - (input.maxAgeDays * DAY_MS);
  const recentCutoff = evaluated - DAY_MS;
  const currentRecords = records.filter((record) =>
    record.toolVersion === input.toolVersion && record.clientVersion === input.clientVersion);
  const current = summarize(currentRecords, cutoff, evaluated, evaluatedAt);
  const recent = summarize(currentRecords, Math.max(cutoff, recentCutoff), evaluated, evaluatedAt);
  const baseline = summarize(currentRecords, cutoff, Math.max(cutoff, recentCutoff), evaluatedAt);
  const successRateDrop = recent.successRate != null && baseline.successRate != null
    ? Number((recent.successRate - baseline.successRate).toFixed(4))
    : null;
  const alerts = [];
  if (recent.failedNodeCount >= input.minimumSignedNodes && recent.successfulNodeCount === 0) {
    alerts.push({
      type: "POSSIBLE_OUTAGE",
      severity: "high",
      message: "No recent signed-node successes and multiple recent failures were observed for the current route.",
    });
  }
  if (recent.distinctSignedNodeCount >= input.minimumSignedNodes
      && baseline.distinctSignedNodeCount >= input.minimumSignedNodes
      && successRateDrop <= -0.25) {
    alerts.push({
      type: "REGRESSION",
      severity: successRateDrop <= -0.5 ? "high" : "medium",
      successRateDrop,
      message: "Recent success is materially below the earlier evidence window for the current route.",
    });
  }
  const candidates = candidateRoutes(records, feedback, cutoff, evaluatedAt, input.minimumSignedNodes);
  const feedbackImpact = candidates.reduce((total, candidate) => ({
    succeeded: total.succeeded + candidate.feedback.succeeded,
    failed: total.failed + candidate.feedback.failed,
    notAttempted: total.notAttempted + candidate.feedback.notAttempted,
    attemptsAvoided: total.attemptsAvoided + candidate.feedback.attemptsAvoided,
    estimatedTokensAvoided: total.estimatedTokensAvoided + candidate.feedback.estimatedTokensAvoided,
    estimatedLatencyMsAvoided: total.estimatedLatencyMsAvoided + candidate.feedback.estimatedLatencyMsAvoided,
  }), { succeeded: 0, failed: 0, notAttempted: 0, attemptsAvoided: 0, estimatedTokensAvoided: 0, estimatedLatencyMsAvoided: 0 });
  const currentCandidate = candidates.find((candidate) =>
    candidate.toolVersion === input.toolVersion && candidate.clientVersion === input.clientVersion);
  const alternative = candidates.find((candidate) => candidate.supported
    && (candidate.toolVersion !== input.toolVersion || candidate.clientVersion !== input.clientVersion));
  let action = "PROCEED_WITH_CAUTION";
  if (current.distinctSignedNodeCount === 0) action = alternative ? "UNLOCK_SUPPORTED_ROUTE" : "NO_RECENT_EVIDENCE";
  else if (alerts.length > 0 || (current.successRate ?? 0) < 0.5) action = alternative ? "UNLOCK_SUPPORTED_ROUTE" : "AVOID_CURRENT_ROUTE";
  else if (current.successRate >= 0.8 && current.distinctSignedNodeCount >= input.minimumSignedNodes) action = "PROCEED";

  return {
    schema: "agentwex.preflight-assessment.v0.1",
    evaluatedAt,
    cell: {
      toolRegistry: input.toolRegistry,
      toolId: input.toolId,
      toolVersion: input.toolVersion,
      clientId: input.clientId,
      clientVersion: input.clientVersion,
      environment: input.environment,
      authMode: input.authMode,
      operation: input.operation,
    },
    currentRoute: current,
    recentWindow: recent,
    baselineWindow: baseline,
    evidenceConfidence: confidenceFor(current),
    alerts,
    recommendation: {
      action,
      supportedAlternativeAvailable: Boolean(alternative),
      currentRouteSupported: Boolean(currentCandidate?.supported),
      routeDetailsSealed: action === "UNLOCK_SUPPORTED_ROUTE",
      creditRequiredToUnlock: action === "UNLOCK_SUPPORTED_ROUTE" ? 1 : 0,
      gateRequired: true,
      authorityGranted: false,
    },
    candidateSummary: {
      supportedCandidates: candidates.filter((candidate) => candidate.supported).length,
      observedCandidates: candidates.length,
      strongestDistinctSignedNodeCount: candidates[0]?.distinctSignedNodeCount ?? 0,
      feedbackImpact,
    },
    _rankedCandidates: candidates,
    controllerIndependenceVerified: false,
    executionTruthVerified: false,
    authorityGranted: false,
  };
}

export function publicPreflightAssessment(assessment) {
  const { _rankedCandidates, ...visible } = assessment;
  return visible;
}

export function buildReliabilityAlerts(records, evaluatedAt = new Date().toISOString()) {
  const cells = new Map();
  for (const record of records) {
    const key = [record.toolRegistry, record.toolId, record.toolVersion, record.clientId,
      record.clientVersion, record.environment, record.authMode, record.operation].join("|");
    const cell = cells.get(key) ?? { records: [], input: {
      toolRegistry: record.toolRegistry,
      toolId: record.toolId,
      toolVersion: record.toolVersion,
      clientId: record.clientId,
      clientVersion: record.clientVersion,
      environment: record.environment,
      authMode: record.authMode,
      operation: record.operation,
      maxAgeDays: 7,
      minimumSignedNodes: 2,
    } };
    cell.records.push(record);
    cells.set(key, cell);
  }
  return [...cells.values()].flatMap(({ records: cellRecords, input }) => {
    const assessment = evaluatePreflight(cellRecords, [], input, evaluatedAt);
    return assessment.alerts.map((alert) => ({
      ...alert,
      cell: assessment.cell,
      recentWindow: assessment.recentWindow,
      baselineWindow: assessment.baselineWindow,
      evidenceConfidence: assessment.evidenceConfidence,
      authorityGranted: false,
    }));
  }).sort((left, right) =>
    ({ high: 0, medium: 1, low: 2 })[left.severity] - ({ high: 0, medium: 1, low: 2 })[right.severity]
    || left.cell.toolId.localeCompare(right.cell.toolId));
}
