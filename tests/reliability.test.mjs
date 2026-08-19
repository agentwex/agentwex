import assert from "node:assert/strict";
import test from "node:test";
import { buildReliabilityAlerts, evaluatePreflight, publicPreflightAssessment } from "../exchange/knowledge-exchange-v0.1/reliability.mjs";

const input = {
  toolRegistry: "mcp",
  toolId: "io.github.example/github-mcp",
  toolVersion: "3.1.0",
  clientId: "claude-code",
  clientVersion: "1.7.0",
  environment: "macos-arm64",
  authMode: "oauth-pkce",
  operation: "repository-search",
  maxAgeDays: 7,
  minimumIndependentRoots: 2,
};

const base = {
  status: "accepted",
  toolRegistry: input.toolRegistry,
  toolId: input.toolId,
  toolVersion: input.toolVersion,
  clientId: input.clientId,
  clientVersion: input.clientVersion,
  environment: input.environment,
  authMode: input.authMode,
  operation: input.operation,
  errorClass: null,
  resolutionKind: "none",
  routeFingerprint: "sha256:current-route",
  independenceBasis: "declared",
};

const records = [
  { ...base, agentId: "node-a", provenanceRootId: "baseline-a", outcome: "success", observedAt: "2026-08-13T12:00:00.000Z" },
  { ...base, agentId: "node-b", provenanceRootId: "baseline-b", outcome: "success", observedAt: "2026-08-13T12:01:00.000Z" },
  { ...base, agentId: "node-a", provenanceRootId: "recent-a", outcome: "failure", errorClass: "oauth-callback-mismatch", observedAt: "2026-08-16T10:00:00.000Z" },
  { ...base, agentId: "node-b", provenanceRootId: "recent-b", outcome: "failure", errorClass: "oauth-callback-mismatch", observedAt: "2026-08-16T10:01:00.000Z" },
  { ...base, agentId: "node-c", provenanceRootId: "alternate-c", toolVersion: "3.2.0", clientVersion: "1.8.0", outcome: "success", resolutionKind: "upgrade-client-and-tool", routeFingerprint: "sha256:alternate-route", observedAt: "2026-08-16T10:02:00.000Z" },
  { ...base, agentId: "node-d", provenanceRootId: "alternate-d", toolVersion: "3.2.0", clientVersion: "1.8.0", outcome: "success", resolutionKind: "upgrade-client-and-tool", routeFingerprint: "sha256:alternate-route", observedAt: "2026-08-16T10:03:00.000Z" },
];

test("preflight detects an outage and regression before recommending a sealed supported route", () => {
  const assessment = evaluatePreflight(records, [{
    routeFingerprint: "sha256:alternate-route",
    outcome: "succeeded",
    attemptsAvoided: 2,
    estimatedTokensAvoided: 4000,
    estimatedLatencyMsAvoided: 15000,
  }], input, "2026-08-16T12:00:00.000Z");

  assert.equal(assessment.currentRoute.distinctSignedNodeCount, 2);
  assert.equal(assessment.currentRoute.successRate, 0);
  assert.equal(assessment.recentWindow.failedNodeCount, 2);
  assert.equal(assessment.baselineWindow.successRate, 1);
  assert.deepEqual(assessment.alerts.map((alert) => alert.type), ["POSSIBLE_OUTAGE", "REGRESSION"]);
  assert.equal(assessment.recommendation.action, "UNLOCK_SUPPORTED_ROUTE");
  assert.equal(assessment.recommendation.creditRequiredToUnlock, 1);
  assert.equal(assessment.candidateSummary.supportedCandidates, 1);
  assert.equal(assessment.candidateSummary.feedbackImpact.attemptsAvoided, 2);
  assert.equal(assessment._rankedCandidates[0].toolVersion, "3.2.0");
  assert.equal(assessment._rankedCandidates[0].feedback.successRate, 1);

  const visible = publicPreflightAssessment(assessment);
  assert.equal("_rankedCandidates" in visible, false);
  assert.equal(JSON.stringify(visible).includes("alternate-route"), false);
  assert.equal(visible.authorityGranted, false);
  assert.equal(visible.recommendation.gateRequired, true);
});

test("network alerts contain aggregate compatibility evidence without node identities", () => {
  const alerts = buildReliabilityAlerts(records, "2026-08-16T12:00:00.000Z");
  assert.deepEqual(alerts.map((alert) => alert.type), ["POSSIBLE_OUTAGE", "REGRESSION"]);
  assert.equal(alerts[0].cell.toolVersion, "3.1.0");
  assert.equal(alerts[0].authorityGranted, false);
  assert.equal(JSON.stringify(alerts).includes("node-a"), false);
  assert.equal(JSON.stringify(alerts).includes("provenanceRootId"), false);
});

test("future-dated evidence cannot support or inflate a route", () => {
  const future = records.map((record, index) => ({
    ...record,
    agentId: `future-${index}`,
    toolVersion: "9.9.9",
    clientVersion: "9.9.9",
    outcome: "success",
    routeFingerprint: "sha256:future-route",
    observedAt: "2026-08-17T12:00:00.000Z",
  }));
  const assessment = evaluatePreflight([...records, ...future], [], input, "2026-08-16T12:00:00.000Z");
  assert.equal(assessment._rankedCandidates.some((candidate) => candidate.routeFingerprint === "sha256:future-route"), false);
  assert.ok(assessment.currentRoute.freshnessHours >= 0);
});
