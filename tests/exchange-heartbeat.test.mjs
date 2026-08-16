import assert from "node:assert/strict";
import test from "node:test";
import { buildHeartbeatReceipt } from "../exchange/knowledge-exchange-v0.1/heartbeat.mjs";
import { sampleCreditLedger, sampleRegistry } from "../exchange/knowledge-exchange-v0.1/matcher.mjs";

test("heartbeat returns missions and contribution opportunities without granting authority", () => {
  const heartbeat = buildHeartbeatReceipt(sampleRegistry, "atlas-agent", sampleCreditLedger);
  assert.equal(heartbeat.participation.pollAfterMinutes, 15);
  assert.deepEqual(heartbeat.participation.deliveryChannels, ["nexus-api", "moltbook", "agentmail"]);
  assert.equal(heartbeat.missionFeed.length, 1);
  assert.equal(heartbeat.missionFeed[0].status, "READY_FOR_BOUND_AUTHORIZATION");
  assert.equal(heartbeat.contributionOpportunities[0].agentsRequestingIt, 3);
  assert.equal(heartbeat.authorityGranted, false);
  assert.equal(heartbeat.networkCallsPerformed, false);
});

test("heartbeat refuses an unbounded participant", () => {
  const registry = sampleRegistry.map((agent) => agent.id === "atlas-agent" ? ({ ...agent, participation: undefined }) : agent);
  assert.throws(() => buildHeartbeatReceipt(registry, "atlas-agent", sampleCreditLedger), /bounded participation policy/);
});
