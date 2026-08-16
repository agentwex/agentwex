import assert from "node:assert/strict";
import test from "node:test";
import { evaluateExchange, findDemandForOffer, sampleCreditLedger, sampleRegistry } from "../exchange/knowledge-exchange-v0.1/matcher.mjs";

test("knowledge exchange collapses repeated provenance before readiness", () => {
  const receipt = evaluateExchange(sampleRegistry, "atlas-agent", "need-atlas-1", sampleCreditLedger);
  assert.equal(receipt.match.compatibleContributions, 4);
  assert.equal(receipt.match.recordedIndependentRoots, 3);
  assert.equal(receipt.match.copiesCollapsed, 1);
  assert.equal(receipt.reciprocity.policy, "GIVE_TO_GET");
  assert.equal(receipt.reciprocity.contributionSatisfied, true);
  assert.equal(receipt.reciprocity.earnedCredits, 2);
  assert.equal(receipt.release.status, "READY_FOR_BOUND_AUTHORIZATION");
  assert.equal(receipt.release.authorityGranted, false);
  assert.equal(receipt.release.rawDataTransferred, false);
});

test("knowledge exchange seals results from agents that have not contributed", () => {
  const receipt = evaluateExchange(sampleRegistry, "atlas-agent", "need-atlas-1", []);
  assert.equal(receipt.release.status, "CONTRIBUTION_REQUIRED");
  assert.equal(receipt.release.output, null);
  assert.equal(receipt.reciprocity.contributionSatisfied, false);
  assert.deepEqual(receipt.evidenceFamilies, []);
});

test("a manifest cannot self-assert an accepted contribution", () => {
  const registry = sampleRegistry.map((agent) => agent.id !== "atlas-agent" ? agent : ({
    ...agent,
    offers: agent.offers.map((offer) => ({ ...offer, contributionState: "accepted" })),
  }));
  const receipt = evaluateExchange(registry, "atlas-agent", "need-atlas-1", []);
  assert.equal(receipt.release.status, "CONTRIBUTION_REQUIRED");
  assert.equal(receipt.reciprocity.earnedCredits, 0);
});

test("knowledge exchange withholds output when independent roots are insufficient", () => {
  const registry = sampleRegistry.map((agent) => agent.id !== "atlas-agent" ? agent : ({ ...agent, needs: [{ ...agent.needs[0], minimumIndependentRoots: 4 }] }));
  const receipt = evaluateExchange(registry, "atlas-agent", "need-atlas-1", sampleCreditLedger);
  assert.equal(receipt.release.status, "REQUEST_MORE_EVIDENCE");
  assert.equal(receipt.release.output, null);
});

test("give-to-get demand is discovered without moving payloads", () => {
  const demand = findDemandForOffer(sampleRegistry, "atlas-agent", "aisle-obstructions", "aggregate");
  assert.equal(demand.length, 3);
});
