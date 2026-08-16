import assert from "node:assert/strict";
import test from "node:test";
import { generateSigningIdentity, signRouteReceipt } from "../js/lib/attestation.mjs";

const baseReceipt = {
  schema: "minority-prophet.working-route-comp.v0.1",
  toolRegistry: "mcp",
  toolId: "repo-search",
  toolVersion: "1.0.0",
  clientId: "codex",
  clientVersion: "1.0.0",
  environment: "macos-arm64",
  authMode: "none",
  operation: "repository-search",
  outcome: "success",
  errorClass: null,
  resolutionKind: "none",
  routeFingerprint: "sha256:12345678",
  observedAt: "2026-08-16T12:00:00.000Z",
  provenanceRootId: "sha256:abcdef12",
  independenceBasis: "declared",
};

test("signed navigator receipts use v0.3 only when capability and effect are explicit", () => {
  const signing = generateSigningIdentity();
  const navigator = signRouteReceipt({ ...baseReceipt, capabilityId: "repository.search", effectClass: "read" }, signing);
  const legacy = signRouteReceipt(baseReceipt, signing);
  assert.equal(navigator.schema, "agentwex.working-route-comp.v0.3");
  assert.equal(navigator.effectClass, "read");
  assert.equal(legacy.schema, "agentwex.working-route-comp.v0.2");
});
