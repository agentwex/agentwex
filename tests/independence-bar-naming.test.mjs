import assert from "node:assert/strict";
import test from "node:test";
import { validatePreflight } from "../db/exchange-store.mjs";

const base = {
  schema: "agentwex.preflight-query.v0.1",
  toolRegistry: "mcp",
  toolId: "example/tool",
  toolVersion: "1.0.0",
  clientId: "claude-code",
  clientVersion: "2.1.223",
  environment: "macos-arm64",
  authMode: "none",
  operation: "search",
};

test("the bar is named after the controller groups it actually counts", () => {
  const input = validatePreflight({ ...base, minimumIndependentRoots: 3 });
  assert.ok(input);
  assert.equal(input.minimumIndependentRoots, 3);
});

test("the former name is refused rather than silently defaulted", () => {
  // minimumSignedNodes was never enforced against signed nodes: it was compared
  // against a list collapsed one-per-controller. The name understated the
  // guarantee, and an implementer who read it literally would count nodes and
  // build something weaker while appearing conformant.
  //
  // Accepting it as an alias would have kept that reading alive in every
  // example and copied config. Refusing it means a caller using the old name is
  // told, at the moment they can still cheaply change it.
  assert.equal(validatePreflight({ ...base, minimumSignedNodes: 3 }), null);
});

test("no field mirrors the old name back out", () => {
  const input = validatePreflight({ ...base, minimumIndependentRoots: 4 });
  assert.equal("minimumSignedNodes" in input, false,
    "one name for one concept, on the way in and on the way out");
});

test("the default and the accepted range are unchanged by the rename", () => {
  assert.equal(validatePreflight(base).minimumIndependentRoots, 2);
  assert.equal(validatePreflight({ ...base, minimumIndependentRoots: 1 }), null);
  assert.equal(validatePreflight({ ...base, minimumIndependentRoots: 11 }), null);
});

test("the bar counts controller groups, not signed nodes", async () => {
  // The distinction the name now carries, asserted against the code that
  // enforces it. Three signed nodes under one controller are one root, so a
  // bar of two is not met however many nodes are added.
  const { evaluatePreflight } = await import("../exchange/knowledge-exchange-v0.1/reliability.mjs");
  const input = { ...base, maxAgeDays: 7, minimumIndependentRoots: 2 };
  const record = (agentId, controllerGroupId, observedAt) => ({
    status: "accepted", outcome: "success", observedAt,
    toolRegistry: input.toolRegistry, toolId: input.toolId, toolVersion: input.toolVersion,
    clientId: input.clientId, clientVersion: input.clientVersion, environment: input.environment,
    authMode: input.authMode, operation: input.operation, errorClass: null, resolutionKind: "none",
    routeFingerprint: "sha256:route", independenceBasis: "declared",
    agentId, controllerGroupId, provenanceRootId: `root-${agentId}`,
  });
  const at = "2026-08-19T01:00:00.000Z";

  const oneController = evaluatePreflight([
    record("node-a", "ctrl-1", "2026-08-19T00:00:00.000Z"),
    record("node-b", "ctrl-1", "2026-08-19T00:01:00.000Z"),
    record("node-c", "ctrl-1", "2026-08-19T00:02:00.000Z"),
  ], [], input, at);
  assert.equal(oneController.currentRoute.distinctSignedNodeCount, 3);
  assert.equal(oneController.currentRoute.distinctControllerGroupCount, 1,
    "three nodes under one controller collapse to one root");
  assert.notEqual(oneController.recommendation.action, "PROCEED",
    "a bar of two roots is not met by adding nodes to one controller");

  const twoControllers = evaluatePreflight([
    record("node-a", "ctrl-1", "2026-08-19T00:00:00.000Z"),
    record("node-b", "ctrl-2", "2026-08-19T00:01:00.000Z"),
  ], [], input, at);
  assert.equal(twoControllers.currentRoute.distinctControllerGroupCount, 2);
  assert.equal(twoControllers.recommendation.action, "PROCEED",
    "two genuinely distinct controllers do meet it");
});
