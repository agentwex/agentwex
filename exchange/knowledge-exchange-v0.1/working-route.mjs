const routeKey = (record) => [
  record.toolVersion,
  record.clientVersion,
  record.environment,
  record.authMode,
  record.resolutionKind,
  record.routeFingerprint,
].join("|");

const compatibleWith = (record, query) =>
  record.status === "accepted"
  && record.toolRegistry === query.toolRegistry
  && record.toolId === query.toolId
  && record.clientId === query.clientId
  && record.environment === query.environment
  && record.authMode === query.authMode
  && record.operation === query.operation;

export function evaluateWorkingRoute(records, query, evaluatedAt = new Date().toISOString()) {
  if (query.localEvidenceStatus !== "insufficient") {
    return {
      status: "USE_LOCAL_EVIDENCE_FIRST",
      nextAction: "Use the requesting agent's available evidence before asking the exchange.",
      authorityGranted: false,
    };
  }

  const cutoff = Date.parse(evaluatedAt) - (query.maxAgeDays * 86_400_000);
  const matching = records.filter((record) => compatibleWith(record, query));
  const compatible = matching
    .filter((record) => Date.parse(record.observedAt) >= cutoff)
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
    const route = successfulRoutes.get(key) ?? { records: [], agents: new Set(), key };
    const agentKey = record.agentId ?? `legacy-root:${record.provenanceRootId}`;
    if (route.agents.has(agentKey)) continue;
    route.agents.add(agentKey);
    route.records.push(record);
    successfulRoutes.set(key, route);
  }

  const rankedRoutes = [...successfulRoutes.values()].sort((left, right) =>
    right.records.length - left.records.length
    || right.records[0].observedAt.localeCompare(left.records[0].observedAt));
  const winner = rankedRoutes.find((route) => route.records.length >= query.minimumIndependentRoots);
  const candidateRoutes = rankedRoutes.map((candidate, index) => ({
    rank: index + 1,
    toolVersion: candidate.records[0].toolVersion,
    clientVersion: candidate.records[0].clientVersion,
    environment: candidate.records[0].environment,
    authMode: candidate.records[0].authMode,
    resolutionKind: candidate.records[0].resolutionKind,
    routeFingerprint: candidate.records[0].routeFingerprint,
    distinctSignedNodeCount: candidate.records.length,
    controllerIndependenceVerified: false,
    executionTruthVerified: false,
    evidenceStatus: "unverified-network-evidence",
    // Legacy wire name retained through v0.1. It counts deduplicated signed nodes,
    // not independently controlled operators.
    independentRootCount: candidate.records.length,
    minimumIndependentRoots: query.minimumIndependentRoots,
    firstObservedAt: candidate.records.at(-1).observedAt,
    lastObservedAt: candidate.records[0].observedAt,
    evidenceWindowDays: query.maxAgeDays,
    supported: candidate.records.length >= query.minimumIndependentRoots,
    selected: candidate.key === winner?.key,
  }));
  const status = winner
    ? "RESULT_AVAILABLE"
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
      successfulIndependentRoots: winner?.records.length ?? rankedRoutes[0]?.records.length ?? 0,
      minimumIndependentRoots: query.minimumIndependentRoots,
      distinctSignedNodeSupport: winner?.records.length ?? rankedRoutes[0]?.records.length ?? 0,
      controllerIndependenceVerified: false,
      executionTruthVerified: false,
    },
    selectionPolicy: {
      compatibility: "exact tool, client, environment, auth mode, and operation cell",
      supportUnit: "distinct-signed-node",
      primaryRank: "distinct signed node count after provenance-root collapse",
      tieBreak: "latest signed successful observation",
      versionPreference: "none",
      evidenceWindowDays: query.maxAgeDays,
    },
    candidateRoutes,
    workingRoute: winner ? {
      toolVersion: winner.records[0].toolVersion,
      clientVersion: winner.records[0].clientVersion,
      environment: winner.records[0].environment,
      authMode: winner.records[0].authMode,
      resolutionKind: winner.records[0].resolutionKind,
      routeFingerprint: winner.records[0].routeFingerprint,
      distinctSignedNodeCount: winner.records.length,
      controllerIndependenceVerified: false,
      executionTruthVerified: false,
      evidenceStatus: "unverified-network-evidence",
      independentRootCount: winner.records.length,
      evidenceWindowDays: query.maxAgeDays,
      lastObservedAt: winner.records[0].observedAt,
      verificationLevel: winner.records.every((record) => record.verificationLevel === "distinct-signed-node-v1")
        ? "distinct-signed-node-v1"
        : "mixed-exchange-verification",
    } : null,
    bounty: status === "RESULT_AVAILABLE" ? null : {
      requestedIndependentRuns: Math.max(1, query.minimumIndependentRoots - (rankedRoutes[0]?.records.length ?? 0)),
      reward: "Standard credits are issued only for accepted, additive Working Route Comps from a distinct signed node.",
      arbitraryExecutionAuthorized: false,
    },
    nextAction: status === "RESULT_AVAILABLE"
      ? "Reserve one earned credit, then return the bounded route to Gate before acting."
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
  localEvidenceStatus: "insufficient",
  maxAgeDays: 7,
  minimumIndependentRoots: 2,
};

export const sampleRouteRecords = [
  { id: "route-1", status: "accepted", toolRegistry: sampleRouteQuery.toolRegistry, toolId: sampleRouteQuery.toolId, toolVersion: "3.2.0", clientId: sampleRouteQuery.clientId, clientVersion: "1.8.0", environment: sampleRouteQuery.environment, authMode: sampleRouteQuery.authMode, operation: sampleRouteQuery.operation, outcome: "success", errorClass: null, resolutionKind: "upgrade-client-and-tool", routeFingerprint: "sha256:a1b2c3d4", observedAt: "2026-08-15T18:42:00.000Z", provenanceRootId: "run-independent-a", independenceBasis: "attested" },
  { id: "route-2", status: "accepted", toolRegistry: sampleRouteQuery.toolRegistry, toolId: sampleRouteQuery.toolId, toolVersion: "3.2.0", clientId: sampleRouteQuery.clientId, clientVersion: "1.8.0", environment: sampleRouteQuery.environment, authMode: sampleRouteQuery.authMode, operation: sampleRouteQuery.operation, outcome: "success", errorClass: null, resolutionKind: "upgrade-client-and-tool", routeFingerprint: "sha256:a1b2c3d4", observedAt: "2026-08-15T18:31:00.000Z", provenanceRootId: "run-independent-b", independenceBasis: "attested" },
  { id: "route-3", status: "accepted", toolRegistry: sampleRouteQuery.toolRegistry, toolId: sampleRouteQuery.toolId, toolVersion: "3.2.0", clientId: sampleRouteQuery.clientId, clientVersion: "1.8.0", environment: sampleRouteQuery.environment, authMode: sampleRouteQuery.authMode, operation: sampleRouteQuery.operation, outcome: "success", errorClass: null, resolutionKind: "upgrade-client-and-tool", routeFingerprint: "sha256:a1b2c3d4", observedAt: "2026-08-15T18:25:00.000Z", provenanceRootId: "run-independent-a", independenceBasis: "declared" },
  { id: "route-4", status: "accepted", toolRegistry: sampleRouteQuery.toolRegistry, toolId: sampleRouteQuery.toolId, toolVersion: "3.1.0", clientId: sampleRouteQuery.clientId, clientVersion: "1.7.0", environment: sampleRouteQuery.environment, authMode: sampleRouteQuery.authMode, operation: sampleRouteQuery.operation, outcome: "failure", errorClass: "oauth-callback-mismatch", resolutionKind: "none", routeFingerprint: "sha256:deadbeef", observedAt: "2026-08-15T18:20:00.000Z", provenanceRootId: "run-independent-c", independenceBasis: "attested" },
];
