import assert from "node:assert/strict";
import test from "node:test";
import { assessLocalRecall, localOutcomeFromReceipt, rememberLocalOutcome } from "../js/lib/local-recall.mjs";

const baseReceipt = {
  schema: "agentwex.working-route-comp.v0.3",
  toolRegistry: "mcp",
  toolId: "io.github.example/github-mcp",
  toolVersion: "3.2.0",
  clientId: "codex",
  clientVersion: "1.8.0",
  environment: "macos-arm64",
  authMode: "oauth-pkce",
  operation: "repository-search",
  capabilityId: "repository.search",
  effectClass: "read",
  outcome: "success",
  errorClass: null,
  resolutionKind: "none",
  observedAt: "2026-10-14T11:30:00.000Z",
  routeFingerprint: "sha256:private-fingerprint",
  provenanceRootId: "sha256:private-root",
  attestation: { signature: "private-signature" },
  prompt: "PRIVATE PROMPT",
  arguments: { secret: true },
  result: "PRIVATE RESULT",
  url: "https://private.example.test",
  traceId: "private-trace",
};

const query = {
  toolRegistry: baseReceipt.toolRegistry,
  toolId: baseReceipt.toolId,
  toolVersion: baseReceipt.toolVersion,
  clientId: baseReceipt.clientId,
  clientVersion: baseReceipt.clientVersion,
  environment: baseReceipt.environment,
  authMode: baseReceipt.authMode,
  operation: baseReceipt.operation,
  capabilityId: baseReceipt.capabilityId,
  effectClass: baseReceipt.effectClass,
  maxAgeDays: 7,
};

test("local outcome keeps only bounded compatibility facts", () => {
  const outcome = localOutcomeFromReceipt(baseReceipt);

  assert.deepEqual(outcome, {
    toolRegistry: "mcp",
    toolId: "io.github.example/github-mcp",
    toolVersion: "3.2.0",
    clientId: "codex",
    clientVersion: "1.8.0",
    environment: "macos-arm64",
    authMode: "oauth-pkce",
    operation: "repository-search",
    capabilityId: "repository.search",
    effectClass: "read",
    outcome: "success",
    errorClass: null,
    resolutionKind: "none",
    observedAt: "2026-10-14T11:30:00.000Z",
  });
  for (const forbidden of ["routeFingerprint", "provenanceRootId", "attestation", "prompt", "arguments", "result", "url", "traceId"]) {
    assert.equal(forbidden in outcome, false);
  }
});

test("local outcome memory deduplicates, sorts, and stays bounded", () => {
  let outcomes = rememberLocalOutcome(null, baseReceipt, 2);
  outcomes = rememberLocalOutcome(outcomes, baseReceipt, 2);
  outcomes = rememberLocalOutcome(outcomes, { ...baseReceipt, observedAt: "2026-10-14T11:31:00.000Z", outcome: "failure", errorClass: "timeout" }, 2);
  outcomes = rememberLocalOutcome(outcomes, { ...baseReceipt, observedAt: "2026-10-14T11:32:00.000Z", toolVersion: "3.3.0" }, 2);

  assert.equal(outcomes.length, 2);
  assert.deepEqual(outcomes.map((entry) => entry.observedAt), ["2026-10-14T11:32:00.000Z", "2026-10-14T11:31:00.000Z"]);
});

test("local recall matches the exact cell and excludes stale, future, invalid, and capability-mismatched observations", () => {
  const outcomes = [
    localOutcomeFromReceipt(baseReceipt),
    localOutcomeFromReceipt({ ...baseReceipt, observedAt: "2026-10-14T11:45:00.000Z", outcome: "failure", errorClass: "timeout" }),
    localOutcomeFromReceipt({ ...baseReceipt, observedAt: "2026-09-01T00:00:00.000Z" }),
    localOutcomeFromReceipt({ ...baseReceipt, observedAt: "2026-10-15T12:01:00.000Z" }),
    { ...localOutcomeFromReceipt(baseReceipt), observedAt: "not-a-date" },
    localOutcomeFromReceipt({ ...baseReceipt, observedAt: "2026-10-14T11:50:00.000Z", clientVersion: "1.9.0" }),
    localOutcomeFromReceipt({ ...baseReceipt, observedAt: "2026-10-14T11:55:00.000Z", capabilityId: "repository.write" }),
  ];

  const assessment = assessLocalRecall(outcomes, query, "2026-10-15T12:00:00.000Z");

  assert.equal(assessment.source, "private-local-history");
  assert.equal(assessment.sampleCount, 2);
  assert.equal(assessment.successCount, 1);
  assert.equal(assessment.failureCount, 1);
  assert.equal(assessment.successRate, 0.5);
  assert.equal(assessment.lastObservedAt, "2026-10-14T11:45:00.000Z");
  assert.equal(assessment.freshnessHours, 24.25);
  assert.deepEqual(assessment.topFailureClasses, [{ errorClass: "timeout", count: 1 }]);
  assert.equal(assessment.establishesNetworkSupport, false);
  assert.equal(assessment.creditEligible, false);
  assert.equal(assessment.authorityGranted, false);
});

test("missing or corrupt local history yields an honest empty assessment", () => {
  for (const outcomes of [undefined, null, {}, "bad"]) {
    const assessment = assessLocalRecall(outcomes, query, "2026-10-15T12:00:00.000Z");
    assert.equal(assessment.sampleCount, 0);
    assert.equal(assessment.successRate, null);
    assert.equal(assessment.lastObservedAt, null);
    assert.equal(assessment.freshnessHours, null);
    assert.equal(assessment.establishesNetworkSupport, false);
  }
});
