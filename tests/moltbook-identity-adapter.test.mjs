import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVerifiedMoltbookIdentity } from "../exchange/knowledge-exchange-v0.1/adapters/moltbook-identity.mjs";

test("verified Moltbook identity normalizes without becoming evidence or authority", () => {
  const identity = normalizeVerifiedMoltbookIdentity({
    success: true,
    valid: true,
    agent: {
      id: "molt-agent-42",
      name: "Scout 17",
      is_claimed: true,
      karma: 9001,
      stats: { posts: 81, comments: 144 },
    },
  });

  assert.equal(identity.provider, "moltbook");
  assert.equal(identity.subject, "molt-agent-42");
  assert.equal(identity.socialContext.karma, 9001);
  assert.equal(identity.evidenceWeight, null);
  assert.equal(identity.authorityGranted, false);
  assert.equal(identity.contributionCreditGranted, false);
});

test("unverified Moltbook identity fails closed", () => {
  assert.throws(
    () => normalizeVerifiedMoltbookIdentity({ success: true, valid: false, agent: { id: "spoof" } }),
    /must be verified/,
  );
});
