import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  accountAtAllCuts,
  assessDeclaredIndependenceCut,
} from "../exchange/knowledge-exchange-v0.1/decision-relative-independence.mjs";

const fixture = JSON.parse(await readFile(
  new URL("../conformance/decision-relative-independence/vectors.json", import.meta.url),
  "utf8",
));

test("published decision-relative conformance vectors pass", () => {
  assert.equal(fixture.status, "constructed-conformance-vectors");
  for (const testCase of fixture.cases) {
    const before = JSON.stringify(testCase.observations);
    const result = assessDeclaredIndependenceCut(testCase.observations, testCase.policy);
    assert.equal(result.selected.supportingRootCount, testCase.expect.selectedSupport, testCase.id);
    assert.equal(result.selected.supportSatisfied, testCase.expect.supportSatisfied, testCase.id);
    assert.deepEqual(result.materialAlternativeCuts, testCase.expect.materialAlternativeCuts, testCase.id);
    assert.equal(result.selected.unknownObservationCount, testCase.expect.unknownObservationCount ?? 0, testCase.id);
    for (const [cut, expected] of Object.entries(testCase.expect.alternativeSupport)) {
      assert.equal(result.alternatives[cut].supportingRootCount, expected, `${testCase.id}:${cut}`);
    }
    assert.equal(JSON.stringify(testCase.observations), before, `${testCase.id}: input mutated`);
    assert.deepEqual(result.boundaries, {
      policyInferred: false,
      controllerIndependenceVerified: false,
      actionAuthorityGranted: false,
      fullLineageMutated: false,
    });
  }
});

test("all resolutions remain reportable while one proximal cut is selected", () => {
  const observations = fixture.cases[0].observations;
  const counts = accountAtAllCuts(observations);
  assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([cut, value]) => [cut, value.supportingRootCount])), {
    provenance_root: 3,
    signed_node: 3,
    participant: 3,
    controller_group: 1,
  });
});

test("a missing root is unknown rather than a manufactured independent vote", () => {
  const result = assessDeclaredIndependenceCut(
    fixture.cases[2].observations,
    fixture.cases[2].policy,
  );
  assert.equal(result.selected.unknownObservationCount, 1);
  assert.equal(result.selected.supportingRootCount, 1);
  assert.equal(result.selected.supportSatisfied, false);
});

test("same-time contradictory outcomes at one root fail closed", () => {
  const result = assessDeclaredIndependenceCut([
    { nodeId: "a", controllerGroupId: "c", outcome: "success", observedAt: "2026-08-23T00:00:00Z" },
    { nodeId: "b", controllerGroupId: "c", outcome: "failure", observedAt: "2026-08-23T00:00:00Z" },
  ], {
    decisionId: "d",
    failureDomain: "shared-control",
    independenceCut: "controller_group",
    cutSelectionBasis: "declared",
    minimumSupportingRoots: 1,
  });
  assert.deepEqual(result.selected.conflictedRoots, ["c"]);
  assert.equal(result.selected.supportSatisfied, false);
});

test("WEX refuses to infer an independence policy", () => {
  assert.throws(
    () => assessDeclaredIndependenceCut([], { independenceCut: "controller_group", minimumSupportingRoots: 1 }),
    /decisionId is required/,
  );
  assert.throws(
    () => assessDeclaredIndependenceCut([], {
      decisionId: "d", failureDomain: "x", independenceCut: "human", minimumSupportingRoots: 1,
      cutSelectionBasis: "declared",
    }),
    /unsupported independence cut/,
  );
  assert.throws(
    () => assessDeclaredIndependenceCut([], {
      decisionId: "d", failureDomain: "x", independenceCut: "controller_group",
      minimumSupportingRoots: 1,
    }),
    /cutSelectionBasis is required/,
  );
});

test("the portable policy schema requires both the cut and its selection basis", async () => {
  const schema = JSON.parse(await readFile(
    new URL("../exchange/knowledge-exchange-v0.1/decision-relative-independence-policy.schema.json", import.meta.url),
    "utf8",
  ));
  assert.ok(schema.required.includes("independenceCut"));
  assert.ok(schema.required.includes("cutSelectionBasis"));
  assert.deepEqual(schema.properties.independenceCut.enum, [
    "provenance_root", "signed_node", "participant", "controller_group",
  ]);
});
