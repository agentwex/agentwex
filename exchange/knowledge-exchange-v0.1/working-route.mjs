const routeKey = (record) => [
  record.toolRegistry,
  record.toolId,
  record.toolVersion,
  record.clientId,
  record.clientVersion,
  record.environment,
  record.authMode,
  record.operation,
  record.resolutionKind,
  record.routeFingerprint,
].join("|");

const MATCH_PRIORITY = {
  EXACT_MATCH: 0,
  COMPATIBLE_ROUTE: 1,
  ALTERNATIVE_ROUTE: 2,
};

const controllerKey = (record) => record.controllerGroupId ?? record.agentId ?? `legacy-root:${record.provenanceRootId}`;
const participantKey = (record) => record.participantId ?? record.agentId ?? `legacy-root:${record.provenanceRootId}`;

export function classifyRouteMatch(record, query) {
  if (record.status !== "accepted" || record.environment !== query.environment) return null;
  const exactCell = record.toolRegistry === query.toolRegistry
    && record.toolId === query.toolId
    && record.clientId === query.clientId
    && record.authMode === query.authMode
    && record.operation === query.operation;
  if (exactCell) {
    return record.toolVersion === query.attemptedToolVersion
      && record.clientVersion === query.attemptedClientVersion
      ? "EXACT_MATCH"
      : "COMPATIBLE_ROUTE";
  }
  const alternativesEnabled = query.alternativePolicy === "same-capability"
    && query.capabilityId
    && query.effectClass
    && query.effectClass !== "other";
  if (!alternativesEnabled) return null;
  return record.capabilityId === query.capabilityId
    && record.effectClass === query.effectClass
    ? "ALTERNATIVE_ROUTE"
    : null;
}

function changedDimensions(record, query) {
  const dimensions = [];
  if (record.toolRegistry !== query.toolRegistry || record.toolId !== query.toolId) dimensions.push("tool");
  if (record.toolVersion !== query.attemptedToolVersion) dimensions.push("tool-version");
  if (record.clientId !== query.clientId) dimensions.push("client");
  if (record.clientVersion !== query.attemptedClientVersion) dimensions.push("client-version");
  if (record.authMode !== query.authMode) dimensions.push("auth-mode");
  if (record.operation !== query.operation) dimensions.push("operation");
  return dimensions;
}

export function evaluateWorkingRoute(records, query, evaluatedAt = new Date().toISOString()) {
  if (query.localEvidenceStatus !== "insufficient") {
    return {
      status: "USE_LOCAL_EVIDENCE_FIRST",
      nextAction: "Use the requesting agent's available evidence before asking the exchange.",
      authorityGranted: false,
    };
  }

  const evaluated = Date.parse(evaluatedAt);
  const cutoff = evaluated - (query.maxAgeDays * 86_400_000);
  const matching = records
    .map((record) => ({ ...record, matchType: classifyRouteMatch(record, query) }))
    .filter((record) => record.matchType != null);
  const compatible = matching
    .filter((record) => {
      const observed = Date.parse(record.observedAt);
      return Number.isFinite(observed) && observed >= cutoff && observed <= evaluated;
    })
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt));

  const byRoot = new Map();
  for (const record of compatible) {
    if (!byRoot.has(record.provenanceRootId)) byRoot.set(record.provenanceRootId, record);
  }
  const rootRecords = [...byRoot.values()].filter((record) => record.independenceBasis !== "unknown");
  const successfulRootRecords = rootRecords.filter((candidate) => candidate.outcome === "success");
  const successfulRoutes = new Map();
  for (const record of successfulRootRecords) {
    const key = routeKey(record);
    const route = successfulRoutes.get(key) ?? {
      records: [], agents: new Set(), participants: new Set(), controllerGroups: new Set(),
      labParticipants: new Set(), key, matchType: record.matchType,
    };
    const agentKey = record.agentId ?? `legacy-root:${record.provenanceRootId}`;
    if (route.agents.has(agentKey)) continue;
    route.agents.add(agentKey);
    route.participants.add(participantKey(record));
    route.controllerGroups.add(controllerKey(record));
    if (record.evidenceScope === "lab") route.labParticipants.add(participantKey(record));
    route.records.push(record);
    successfulRoutes.set(key, route);
  }

  const isSupported = (route) => route.controllerGroups.size >= query.minimumIndependentRoots;
  const isLabReplicated = (route) => route.controllerGroups.size === 1
    && route.labParticipants.size >= 2
    && route.records.every((record) => record.evidenceScope === "lab");
  const rankedRoutes = [...successfulRoutes.values()].sort((left, right) =>
    Number(isSupported(right)) - Number(isSupported(left))
    || Number(isLabReplicated(right)) - Number(isLabReplicated(left))
    || MATCH_PRIORITY[left.matchType] - MATCH_PRIORITY[right.matchType]
    || right.controllerGroups.size - left.controllerGroups.size
    || right.participants.size - left.participants.size
    || right.records[0].observedAt.localeCompare(left.records[0].observedAt));
  const supportedWinner = rankedRoutes.find(isSupported);
  const labWinner = supportedWinner ? null : rankedRoutes.find(isLabReplicated);
  const winner = supportedWinner ?? labWinner;
  const candidateRoutes = rankedRoutes.map((candidate, index) => ({
    rank: index + 1,
    matchType: candidate.matchType,
    toolRegistry: candidate.records[0].toolRegistry,
    toolId: candidate.records[0].toolId,
    toolVersion: candidate.records[0].toolVersion,
    clientId: candidate.records[0].clientId,
    clientVersion: candidate.records[0].clientVersion,
    environment: candidate.records[0].environment,
    authMode: candidate.records[0].authMode,
    resolutionKind: candidate.records[0].resolutionKind,
    operation: candidate.records[0].operation,
    capabilityId: candidate.records[0].capabilityId ?? null,
    effectClass: candidate.records[0].effectClass ?? null,
    changedDimensions: changedDimensions(candidate.records[0], query),
    substitutionRequired: candidate.matchType === "ALTERNATIVE_ROUTE",
    navigationBasis: candidate.matchType === "ALTERNATIVE_ROUTE"
      ? "declared-capability-and-effect"
      : "exact-compatibility-cell",
    capabilityEquivalenceVerified: false,
    routeFingerprint: candidate.records[0].routeFingerprint,
    distinctSignedNodeCount: candidate.records.length,
    distinctParticipantCount: candidate.participants.size,
    distinctControllerGroupCount: candidate.controllerGroups.size,
    firstPartyLabReplicated: isLabReplicated(candidate),
    supportStatus: isSupported(candidate) ? "supported" : isLabReplicated(candidate) ? "lab-observed" : "observed",
    controllerIndependenceVerified: false,
    executionTruthVerified: false,
    evidenceStatus: "unverified-network-evidence",
    // Legacy wire name retained through v0.1. It counts deduplicated signed nodes,
    // not independently controlled operators.
    independentRootCount: candidate.controllerGroups.size,
    minimumIndependentRoots: query.minimumIndependentRoots,
    firstObservedAt: candidate.records.at(-1).observedAt,
    lastObservedAt: candidate.records[0].observedAt,
    evidenceWindowDays: query.maxAgeDays,
    supported: isSupported(candidate),
    selected: candidate.key === winner?.key,
  }));
  const status = supportedWinner
    ? "RESULT_AVAILABLE"
    : labWinner
      ? "LAB_RESULT_AVAILABLE"
    : compatible.length === 0
      ? "BOUNTY_OPEN"
      : "SEEK_MORE_INDEPENDENT_RUNS";

  return {
    schema: "minority-prophet.working-route-assessment.v0.1",
    status,
    query: {
      toolRegistry: query.toolRegistry,
      toolId: query.toolId,
      attemptedToolVersion: query.attemptedToolVersion,
      clientId: query.clientId,
      attemptedClientVersion: query.attemptedClientVersion,
      environment: query.environment,
      authMode: query.authMode,
      operation: query.operation,
      maxAgeDays: query.maxAgeDays,
    },
    evidence: {
      compatibleReceipts: compatible.length,
      staleReceipts: matching.length - compatible.length,
      recordedIndependentRoots: rootRecords.length,
      copiesCollapsed: compatible.length - byRoot.size,
      repeatedNodeReceiptsCollapsed: successfulRootRecords.length - [...successfulRoutes.values()].reduce((total, route) => total + route.records.length, 0),
      controllerGroupsCollapsed: (winner?.records.length ?? rankedRoutes[0]?.records.length ?? 0)
        - (winner?.controllerGroups.size ?? rankedRoutes[0]?.controllerGroups.size ?? 0),
      successfulIndependentRoots: winner?.controllerGroups.size ?? rankedRoutes[0]?.controllerGroups.size ?? 0,
      minimumIndependentRoots: query.minimumIndependentRoots,
      distinctSignedNodeSupport: winner?.records.length ?? rankedRoutes[0]?.records.length ?? 0,
      distinctParticipantSupport: winner?.participants.size ?? rankedRoutes[0]?.participants.size ?? 0,
      distinctControllerGroupSupport: winner?.controllerGroups.size ?? rankedRoutes[0]?.controllerGroups.size ?? 0,
      firstPartyLabReplicated: Boolean(labWinner),
      controllerIndependenceVerified: false,
      executionTruthVerified: false,
    },
    selectionPolicy: {
      compatibility: query.alternativePolicy === "same-capability"
        ? "exact cell plus explicitly labeled same-capability and same-effect alternatives"
        : "exact tool, client, environment, auth mode, and operation cell",
      supportUnit: "distinct-controller-group; unmapped community nodes remain separate provisional groups",
      primaryRank: "supported status, then first-party lab replication, match proximity, controller groups, participants, and recency",
      tieBreak: "latest signed successful observation",
      versionPreference: "none",
      alternativePolicy: query.alternativePolicy ?? "exact-only",
      semanticSimilarityGrantsSupport: false,
      evidenceWindowDays: query.maxAgeDays,
    },
    candidateRoutes,
    workingRoute: winner ? {
      matchType: winner.matchType,
      toolRegistry: winner.records[0].toolRegistry,
      toolId: winner.records[0].toolId,
      toolVersion: winner.records[0].toolVersion,
      clientId: winner.records[0].clientId,
      clientVersion: winner.records[0].clientVersion,
      environment: winner.records[0].environment,
      authMode: winner.records[0].authMode,
      resolutionKind: winner.records[0].resolutionKind,
      operation: winner.records[0].operation,
      capabilityId: winner.records[0].capabilityId ?? null,
      effectClass: winner.records[0].effectClass ?? null,
      changedDimensions: changedDimensions(winner.records[0], query),
      substitutionRequired: winner.matchType === "ALTERNATIVE_ROUTE",
      navigationBasis: winner.matchType === "ALTERNATIVE_ROUTE"
        ? "declared-capability-and-effect"
        : "exact-compatibility-cell",
      capabilityEquivalenceVerified: false,
      routeFingerprint: winner.records[0].routeFingerprint,
      distinctSignedNodeCount: winner.records.length,
      distinctParticipantCount: winner.participants.size,
      distinctControllerGroupCount: winner.controllerGroups.size,
      firstPartyLabReplicated: Boolean(labWinner),
      supportStatus: labWinner ? "lab-observed" : "supported",
      controllerIndependenceVerified: false,
      executionTruthVerified: false,
      evidenceStatus: labWinner ? "first-party-lab-replicated" : "unverified-network-evidence",
      independentRootCount: winner.controllerGroups.size,
      evidenceWindowDays: query.maxAgeDays,
      lastObservedAt: winner.records[0].observedAt,
      verificationLevel: labWinner
        ? "first-party-lab-replicated-v1"
        : winner.records.every((record) => record.verificationLevel === "distinct-signed-node-v1")
          ? "distinct-signed-node-v1"
        : "mixed-exchange-verification",
    } : null,
    bounty: status === "RESULT_AVAILABLE" ? null : {
      requestedIndependentRuns: Math.max(1, query.minimumIndependentRoots - (winner?.controllerGroups.size ?? rankedRoutes[0]?.controllerGroups.size ?? 0)),
      reward: "Standard credits are issued only for accepted, additive Working Route Comps from a distinct signed node.",
      labRouteAlreadyObserved: status === "LAB_RESULT_AVAILABLE",
      arbitraryExecutionAuthorized: false,
    },
    nextAction: status === "RESULT_AVAILABLE"
      ? "Reserve one earned credit, then return the bounded route to Gate before acting."
      : status === "LAB_RESULT_AVAILABLE"
        ? "A first-party route was reproduced by two lab participants. Return it to Gate as provisional evidence and keep seeking an external controller."
      : status === "BOUNTY_OPEN"
        ? "Publish the missing compatibility cell to eligible agents; do not authorize arbitrary execution."
        : "Keep the bounty open until enough distinct signed nodes support one route.",
    authorityGranted: false,
  };
}

export const sampleRouteQuery = {
  toolRegistry: "mcp",
  toolId: "io.github.example/github-mcp",
  attemptedToolVersion: "3.1.0",
  clientId: "claude-code",
  attemptedClientVersion: "1.7.0",
  environment: "macos-arm64",
  authMode: "oauth-pkce",
  operation: "repository-search",
  capabilityId: "repository.search",
  effectClass: "read",
  alternativePolicy: "same-capability",
  localEvidenceStatus: "insufficient",
  maxAgeDays: 7,
  minimumIndependentRoots: 2,
};

export const sampleRouteRecords = [
  { id: "route-1", status: "accepted", toolRegistry: sampleRouteQuery.toolRegistry, toolId: sampleRouteQuery.toolId, toolVersion: "3.2.0", clientId: sampleRouteQuery.clientId, clientVersion: "1.8.0", environment: sampleRouteQuery.environment, authMode: sampleRouteQuery.authMode, operation: sampleRouteQuery.operation, capabilityId: sampleRouteQuery.capabilityId, effectClass: sampleRouteQuery.effectClass, outcome: "success", errorClass: null, resolutionKind: "upgrade-client-and-tool", routeFingerprint: "sha256:a1b2c3d4", observedAt: "2026-08-15T18:42:00.000Z", provenanceRootId: "run-independent-a", independenceBasis: "attested" },
  { id: "route-2", status: "accepted", toolRegistry: sampleRouteQuery.toolRegistry, toolId: sampleRouteQuery.toolId, toolVersion: "3.2.0", clientId: sampleRouteQuery.clientId, clientVersion: "1.8.0", environment: sampleRouteQuery.environment, authMode: sampleRouteQuery.authMode, operation: sampleRouteQuery.operation, capabilityId: sampleRouteQuery.capabilityId, effectClass: sampleRouteQuery.effectClass, outcome: "success", errorClass: null, resolutionKind: "upgrade-client-and-tool", routeFingerprint: "sha256:a1b2c3d4", observedAt: "2026-08-15T18:31:00.000Z", provenanceRootId: "run-independent-b", independenceBasis: "attested" },
  { id: "route-3", status: "accepted", toolRegistry: sampleRouteQuery.toolRegistry, toolId: sampleRouteQuery.toolId, toolVersion: "3.2.0", clientId: sampleRouteQuery.clientId, clientVersion: "1.8.0", environment: sampleRouteQuery.environment, authMode: sampleRouteQuery.authMode, operation: sampleRouteQuery.operation, capabilityId: sampleRouteQuery.capabilityId, effectClass: sampleRouteQuery.effectClass, outcome: "success", errorClass: null, resolutionKind: "upgrade-client-and-tool", routeFingerprint: "sha256:a1b2c3d4", observedAt: "2026-08-15T18:25:00.000Z", provenanceRootId: "run-independent-a", independenceBasis: "declared" },
  { id: "route-4", status: "accepted", toolRegistry: sampleRouteQuery.toolRegistry, toolId: sampleRouteQuery.toolId, toolVersion: "3.1.0", clientId: sampleRouteQuery.clientId, clientVersion: "1.7.0", environment: sampleRouteQuery.environment, authMode: sampleRouteQuery.authMode, operation: sampleRouteQuery.operation, capabilityId: sampleRouteQuery.capabilityId, effectClass: sampleRouteQuery.effectClass, outcome: "failure", errorClass: "oauth-callback-mismatch", resolutionKind: "none", routeFingerprint: "sha256:deadbeef", observedAt: "2026-08-15T18:20:00.000Z", provenanceRootId: "run-independent-c", independenceBasis: "attested" },
];
