import assert from "node:assert/strict";
import test from "node:test";
import { evaluateWorkingRoute, sampleRouteQuery, sampleRouteRecords } from "../exchange/knowledge-exchange-v0.1/working-route.mjs";

test("working-route exchange returns a route only after distinct signed-node support", () => {
  const assessment = evaluateWorkingRoute(sampleRouteRecords, sampleRouteQuery, "2026-08-15T19:00:00.000Z");
  assert.equal(assessment.status, "RESULT_AVAILABLE");
  assert.equal(assessment.evidence.compatibleReceipts, 4);
  assert.equal(assessment.evidence.staleReceipts, 0);
  assert.equal(assessment.evidence.recordedIndependentRoots, 3);
  assert.equal(assessment.evidence.copiesCollapsed, 1);
  assert.equal(assessment.evidence.successfulIndependentRoots, 2);
  assert.equal(assessment.workingRoute.toolVersion, "3.2.0");
  assert.equal(assessment.workingRoute.clientVersion, "1.8.0");
  assert.equal(assessment.workingRoute.independentRootCount, 2);
  assert.equal(assessment.workingRoute.distinctSignedNodeCount, 2);
  assert.equal(assessment.workingRoute.controllerIndependenceVerified, false);
  assert.equal(assessment.workingRoute.executionTruthVerified, false);
  assert.equal(assessment.workingRoute.evidenceWindowDays, 7);
  assert.equal(assessment.workingRoute.routeFingerprint, "sha256:a1b2c3d4");
  assert.equal(Object.hasOwn(assessment.workingRoute, ["rec", "ipeFingerprint"].join("")), false);
  assert.equal(assessment.candidateRoutes.length, 1);
  assert.equal(assessment.candidateRoutes[0].rank, 1);
  assert.equal(assessment.candidateRoutes[0].selected, true);
  assert.deepEqual(assessment.selectionPolicy, {
    compatibility: "exact tool, client, environment, auth mode, and operation cell",
    supportUnit: "distinct-signed-node",
    primaryRank: "distinct signed node count after provenance-root collapse",
    tieBreak: "latest signed successful observation",
    versionPreference: "none",
    evidenceWindowDays: 7,
  });
  assert.equal(assessment.authorityGranted, false);
});

test("distinct working combinations remain separate and recency breaks an equal-support tie", () => {
  const alternate = [
    { ...sampleRouteRecords[0], id: "alternate-a", toolVersion: "3.3.0", clientVersion: "1.9.0", routeFingerprint: "sha256:alternate1", observedAt: "2026-08-15T18:55:00.000Z", provenanceRootId: "alternate-root-a" },
    { ...sampleRouteRecords[1], id: "alternate-b", toolVersion: "3.3.0", clientVersion: "1.9.0", routeFingerprint: "sha256:alternate1", observedAt: "2026-08-15T18:54:00.000Z", provenanceRootId: "alternate-root-b" },
  ];
  const assessment = evaluateWorkingRoute([...sampleRouteRecords, ...alternate], sampleRouteQuery, "2026-08-15T19:00:00.000Z");

  assert.equal(assessment.candidateRoutes.length, 2);
  assert.equal(assessment.candidateRoutes[0].toolVersion, "3.3.0");
  assert.equal(assessment.candidateRoutes[0].rank, 1);
  assert.equal(assessment.candidateRoutes[0].selected, true);
  assert.equal(assessment.candidateRoutes[1].toolVersion, "3.2.0");
  assert.equal(assessment.candidateRoutes[1].rank, 2);
  assert.equal(assessment.candidateRoutes[1].selected, false);
});

test("distinct route fingerprints never merge just because versions match", () => {
  const records = [
    { ...sampleRouteRecords[0], id: "route-shape-a", routeFingerprint: "sha256:route-a", provenanceRootId: "root-a" },
    { ...sampleRouteRecords[1], id: "route-shape-b", routeFingerprint: "sha256:route-b", provenanceRootId: "root-b" },
  ];
  const assessment = evaluateWorkingRoute(records, sampleRouteQuery, "2026-08-15T19:00:00.000Z");

  assert.equal(assessment.status, "SEEK_MORE_INDEPENDENT_RUNS");
  assert.equal(assessment.workingRoute, null);
  assert.equal(assessment.candidateRoutes.length, 2);
  assert.deepEqual(assessment.candidateRoutes.map((route) => route.independentRootCount), [1, 1]);
});

test("multiple roots from one authenticated node remain one support signal", () => {
  const records = [
    { ...sampleRouteRecords[0], agentId: "agent-one", provenanceRootId: "root-a" },
    { ...sampleRouteRecords[1], agentId: "agent-one", provenanceRootId: "root-b" },
  ];
  const assessment = evaluateWorkingRoute(records, sampleRouteQuery, "2026-08-15T19:00:00.000Z");
  assert.equal(assessment.status, "SEEK_MORE_INDEPENDENT_RUNS");
  assert.equal(assessment.evidence.successfulIndependentRoots, 1);
  assert.equal(assessment.evidence.repeatedNodeReceiptsCollapsed, 1);
});

test("receipts outside the requested evidence window cannot support a route", () => {
  const stale = sampleRouteRecords.map((record) => ({ ...record, observedAt: "2026-07-01T00:00:00.000Z" }));
  const assessment = evaluateWorkingRoute(stale, sampleRouteQuery, "2026-08-15T19:00:00.000Z");

  assert.equal(assessment.status, "BOUNTY_OPEN");
  assert.equal(assessment.evidence.compatibleReceipts, 0);
  assert.equal(assessment.evidence.staleReceipts, 4);
  assert.deepEqual(assessment.candidateRoutes, []);
});

test("missing private evidence opens a bounty instead of inventing a route", () => {
  const assessment = evaluateWorkingRoute([], sampleRouteQuery, "2026-08-15T19:00:00.000Z");
  assert.equal(assessment.status, "BOUNTY_OPEN");
  assert.equal(assessment.workingRoute, null);
  assert.equal(assessment.bounty.requestedIndependentRuns, 2);
  assert.equal(assessment.bounty.arbitraryExecutionAuthorized, false);
});

test("one successful run keeps the bounty open for another independent result", () => {
  const assessment = evaluateWorkingRoute([sampleRouteRecords[0]], sampleRouteQuery, "2026-08-15T19:00:00.000Z");
  assert.equal(assessment.status, "SEEK_MORE_INDEPENDENT_RUNS");
  assert.equal(assessment.workingRoute, null);
  assert.equal(assessment.bounty.requestedIndependentRuns, 1);
});

test("exchange requires the agent to use sufficient local evidence first", () => {
  const assessment = evaluateWorkingRoute(sampleRouteRecords, { ...sampleRouteQuery, localEvidenceStatus: "sufficient" }, "2026-08-15T19:00:00.000Z");
  assert.deepEqual(assessment, {
    status: "USE_LOCAL_EVIDENCE_FIRST",
    nextAction: "Use the requesting agent's available evidence before asking the exchange.",
    authorityGranted: false,
  });
});
