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
  assert.ok(input, "the canonical name is accepted");
  assert.equal(input.minimumIndependentRoots, 3);
});

test("the historical name still works and means the same thing", () => {
  // minimumSignedNodes was never enforced against signed nodes: it was compared
  // against a list collapsed one-per-controller. Renaming it corrected the
  // label, not the behaviour, so old callers must keep working unchanged.
  const legacy = validatePreflight({ ...base, minimumSignedNodes: 3 });
  const canonical = validatePreflight({ ...base, minimumIndependentRoots: 3 });
  assert.equal(legacy.minimumIndependentRoots, 3);
  assert.deepEqual(legacy, canonical, "the two spellings produce an identical validated input");
});

test("both spellings are mirrored, so existing readers keep working", () => {
  const input = validatePreflight({ ...base, minimumIndependentRoots: 4 });
  assert.equal(input.minimumSignedNodes, 4, "the deprecated field mirrors the canonical one");
});

test("a caller who supplies both and disagrees is refused rather than guessed at", () => {
  assert.equal(validatePreflight({ ...base, minimumIndependentRoots: 2, minimumSignedNodes: 5 }), null);
  assert.ok(validatePreflight({ ...base, minimumIndependentRoots: 2, minimumSignedNodes: 2 }),
    "agreeing duplicates are harmless");
});

test("the default and the accepted range are unchanged by the rename", () => {
  assert.equal(validatePreflight(base).minimumIndependentRoots, 2);
  assert.equal(validatePreflight({ ...base, minimumIndependentRoots: 1 }), null);
  assert.equal(validatePreflight({ ...base, minimumIndependentRoots: 11 }), null);
  assert.equal(validatePreflight({ ...base, minimumSignedNodes: 1 }), null, "the alias is bounded too");
});
