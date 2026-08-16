import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { generateSigningIdentity, publicSigningIdentity, signRouteReceipt } from "../js/lib/attestation.mjs";

if (!process.argv.includes("--live")) {
  throw new Error("Refusing to create production test records without explicit --live");
}

const baseUrl = process.env.AGENTWEX_PUBLIC_URL ?? "https://agentwex.xyz";
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const accounts = [];
const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

async function request(path, { method = "GET", account, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(account ? { authorization: `Bearer ${account.apiKey}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({ error: "invalid_json" }));
  assert.ok(response.ok, `${path} returned ${response.status}: ${payload.error ?? "unknown error"}`);
  return payload;
}

async function signup(role) {
  const signing = generateSigningIdentity();
  const account = await request("/api/exchange/signup", {
    method: "POST",
    body: {
      agent: {
        name: `Live smoke ${role} ${runId}`,
        identityProvider: "custom",
        externalSubject: `live-smoke-${runId}-${role}`,
        signingKey: publicSigningIdentity(signing),
      },
      participation: { heartbeatMinutes: 15, deliveryChannel: "nexus-api", dailyCreditSpendLimit: 10 },
    },
  });
  const result = { ...account, signing };
  accounts.push(result);
  return result;
}

function receipt(account, { queryId, outcome, toolVersion, clientVersion, resolutionKind, suffix }) {
  const observedAt = new Date().toISOString();
  return signRouteReceipt({
    ...(queryId ? { queryId } : {}),
    toolRegistry: "mcp",
    toolId: "io.agentwex/live-smoke-tool",
    toolVersion,
    clientId: "agentwex-live-smoke",
    clientVersion,
    environment: "other",
    authMode: "none",
    operation: "production-lifecycle-smoke",
    outcome,
    errorClass: outcome === "failure" ? "compatibility" : null,
    resolutionKind,
    routeFingerprint: sha(`route|${toolVersion}|${clientVersion}|${resolutionKind}`),
    observedAt,
    provenanceRootId: sha(`${account.agentId}|${runId}|${suffix}`),
    independenceBasis: "declared",
  }, account.signing);
}

try {
  const [requester, first, second] = await Promise.all([
    signup("requester"), signup("contributor-a"), signup("contributor-b"),
  ]);

  const failed = await request("/api/exchange/working-route-comps", {
    method: "POST",
    account: requester,
    body: receipt(requester, {
      outcome: "failure", toolVersion: "0.0.1-smoke", clientVersion: "0.0.1-smoke",
      resolutionKind: "none", suffix: "failed-attempt",
    }),
  });
  assert.equal(failed.status, "accepted");
  assert.ok(failed.creditsAwarded >= 1);

  const query = await request("/api/exchange/queries", {
    method: "POST",
    account: requester,
    body: {
      toolRegistry: "mcp",
      toolId: "io.agentwex/live-smoke-tool",
      attemptedToolVersion: "0.0.1-smoke",
      clientId: "agentwex-live-smoke",
      attemptedClientVersion: "0.0.1-smoke",
      environment: "other",
      authMode: "none",
      operation: "production-lifecycle-smoke",
      localEvidenceStatus: "insufficient",
      localEvidenceReceiptHash: sha(`query|${runId}`),
      maxAgeDays: 1,
      minimumIndependentRoots: 2,
    },
  });
  assert.equal(query.status, "BOUNTY_OPEN");

  for (const [account, suffix] of [[first, "success-a"], [second, "success-b"]]) {
    const contribution = await request("/api/exchange/working-route-comps", {
      method: "POST",
      account,
      body: receipt(account, {
        queryId: query.queryId,
        outcome: "success", toolVersion: "0.0.2-smoke", clientVersion: "0.0.2-smoke",
        resolutionKind: "upgrade-client-and-tool", suffix,
      }),
    });
    assert.equal(contribution.status, "accepted");
  }

  const completed = await request(`/api/exchange/queries/${query.queryId}`, { account: requester });
  assert.equal(completed.status, "RESULT_AVAILABLE");
  assert.equal(completed.evidence.distinctSignedNodeSupport, 2);

  const access = await request("/api/exchange/unlock", {
    method: "POST", account: requester, body: { resultId: completed.resultId },
  });
  assert.equal(access.creditsSpent, 1);
  assert.equal(access.routeReceipt.gateRequired, true);
  assert.equal(access.routeReceipt.authorityGranted, false);

  const feedback = await request("/api/exchange/route-feedback", {
    method: "POST",
    account: requester,
    body: { schema: "agentwex.route-feedback.v0.1", resultId: completed.resultId, outcome: "succeeded", attemptsAvoided: 1 },
  });
  assert.equal(feedback.outcome, "succeeded");

  const rotated = await request("/api/exchange/api-keys/rotate", { method: "POST", account: requester });
  requester.apiKey = rotated.apiKey;
  assert.equal((await request("/api/exchange/account", { account: requester })).agentId, requester.agentId);

  console.log("Live lifecycle passed: signup, signed failure, query, two-node support, unlock, feedback, and rotation.");
} finally {
  for (const account of accounts) {
    try { await request("/api/exchange/account", { method: "DELETE", account }); }
    catch { /* Cleanup is best-effort; a failed lifecycle still reports its original assertion. */ }
  }
}
