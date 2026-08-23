import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { evaluatePreflight } from "../exchange/knowledge-exchange-v0.1/reliability.mjs";

const vectors = JSON.parse(
  await readFile(resolve(import.meta.dirname, "..", "conformance", "collapse", "vectors.json"), "utf8"),
);

const cell = {
  toolRegistry: "mcp",
  toolId: "example/tool",
  toolVersion: "1.0.0",
  clientId: "claude-code",
  clientVersion: "2.1.223",
  environment: "macos-arm64",
  authMode: "none",
  operation: "search",
};

const asRecord = (observation) => ({
  ...cell,
  status: "accepted",
  agentId: observation.nodeId,
  controllerGroupId: observation.controllerGroupId,
  participantId: observation.participantId,
  provenanceRootId: `root-${observation.nodeId}-${observation.observedAt}`,
  outcome: observation.outcome,
  errorClass: observation.outcome === "failure" ? "compatibility" : null,
  resolutionKind: "none",
  routeFingerprint: "sha256:route",
  independenceBasis: "declared",
  observedAt: observation.observedAt,
});

test("the published collapse vectors pass against this implementation", () => {
  // The vectors are the exam a third-party listener runs. If they ever fail
  // here, either the rule moved or the implementation drifted from the rule we
  // publish -- and an independent implementer would be right and we would be
  // wrong.
  const input = { ...cell, maxAgeDays: 7, minimumIndependentRoots: 2 };
  const evaluatedAt = "2026-08-19T12:00:00.000Z";

  for (const testCase of vectors.cases) {
    const assessment = evaluatePreflight(testCase.observations.map(asRecord), [], input, evaluatedAt);
    const observed = assessment.currentRoute;
    const label = `${testCase.id}: ${testCase.why}`;

    assert.equal(observed.distinctSignedNodeCount, testCase.expect.signedNodes, `signedNodes -- ${label}`);
    assert.equal(observed.distinctControllerGroupCount, testCase.expect.controllerGroups, `controllerGroups -- ${label}`);
    assert.equal(observed.distinctParticipantCount, testCase.expect.participants, `participants -- ${label}`);
    assert.equal(observed.successfulControllerGroupCount, testCase.expect.supportingControllerGroups,
      `supportingControllerGroups -- ${label}`);
    if (testCase.expect.latestObservedAt) {
      assert.equal(observed.lastObservedAt, testCase.expect.latestObservedAt, `latestObservedAt -- ${label}`);
    }
  }
});

test("no vector is silently skipped", () => {
  assert.ok(vectors.cases.length >= 7, "the published set must not shrink without a version change");
  const ids = vectors.cases.map((testCase) => testCase.id);
  assert.equal(new Set(ids).size, ids.length, "case ids are unique");
  for (const testCase of vectors.cases) {
    assert.ok(testCase.why, `${testCase.id} states why it exists`);
    assert.ok(testCase.observations.length > 0, `${testCase.id} has observations`);
  }
});

test("adding nodes to one controller never reaches the bar", () => {
  // The property behind the central vector, stated independently of the
  // fixture: no number of nodes under a single controller satisfies a bar of
  // two, which is what distinguishes this envelope from ordinary telemetry.
  const input = { ...cell, maxAgeDays: 7, minimumIndependentRoots: 2 };
  for (const nodeCount of [1, 2, 5, 25]) {
    const records = Array.from({ length: nodeCount }, (unused, index) => asRecord({
      nodeId: `node-${index}`,
      controllerGroupId: "ctrl-1",
      participantId: `party-${index}`,
      outcome: "success",
      observedAt: `2026-08-19T00:${String(index).padStart(2, "0")}:00Z`,
    }));
    const assessment = evaluatePreflight(records, [], input, "2026-08-19T12:00:00.000Z");
    assert.equal(assessment.currentRoute.distinctControllerGroupCount, 1,
      `${nodeCount} nodes under one controller collapse to one root`);
    assert.notEqual(assessment.recommendation.action, "PROCEED",
      `${nodeCount} nodes under one controller must not satisfy a bar of two`);
  }
});
