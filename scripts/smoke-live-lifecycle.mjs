import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { generateSigningIdentity, publicSigningIdentity, signRouteReceipt } from "../js/lib/attestation.mjs";
import { readState, writeState } from "../js/lib/config.mjs";
import { runLayeredPreflight } from "../js/lib/layered-preflight.mjs";
import { localOutcomeFromReceipt } from "../js/lib/local-recall.mjs";

if (!process.argv.includes("--live")) {
  throw new Error("Refusing to create production test records without explicit --live");
}

const baseUrl = process.env.AGENTWEX_PUBLIC_URL ?? "https://agentwex.xyz";
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const accounts = [];
const smokeToolId = `io.agentwex/live-smoke-tool-${runId}`;
const acquisitionId = `awx_${randomUUID().replaceAll("-", "")}`;
const localDirectory = await mkdtemp(resolve(tmpdir(), "agentwex-live-lifecycle-"));
const localConfigPath = resolve(localDirectory, "config.json");
const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

async function request(path, { method = "GET", account, body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(account ? { authorization: `Bearer ${account.apiKey}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({ error: "invalid_json" }));
  assert.ok(response.ok, `${path} returned ${response.status}: ${payload.error ?? "unknown error"}`);
  return payload;
}

async function signup(role, acquisitionRef = null) {
  const signing = generateSigningIdentity();
  const account = await request("/api/exchange/signup", {
    method: "POST",
    body: {
      ...(acquisitionRef ? { acquisitionRef } : {}),
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

async function lifecycle(account, eventName, eventData = {}) {
  const result = await request("/api/exchange/lifecycle-events", {
    method: "POST", account, body: { eventName, eventData },
  });
  assert.equal(result.eventName, eventName);
  return result;
}

function receipt(account, { queryId, outcome, toolVersion, clientVersion, resolutionKind, suffix }) {
  // Keep synthetic receipts just behind the edge clock so strict evidence-window
  // checks are not tripped by harmless workstation/Cloudflare clock skew.
  const observedAt = new Date(Date.now() - 5_000).toISOString();
  return signRouteReceipt({
    ...(queryId ? { queryId } : {}),
    toolRegistry: "mcp",
    toolId: smokeToolId,
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
  await request("/api/exchange/acquisition-events", {
    method: "POST",
    headers: { origin: new URL(baseUrl).origin },
    body: {
      acquisitionId, eventName: "join_view", source: "external-pilot",
      medium: "controlled-smoke", campaign: "agentwex_0_7_launch", content: "lifecycle",
      landingPath: "/for-agents",
    },
  });
  const [requester, second] = await Promise.all([
    signup("requester", acquisitionId), signup("contributor-b"),
  ]);
  assert.equal((await lifecycle(requester, "node_install_complete", {
    installStatus: "INSTALLED_RESTART_REQUIRED", runtimeCount: 1, sourceSurface: "attributed_install",
  })).attributed, true);
  assert.equal((await lifecycle(requester, "ready_passive", {
    runtimeCount: 1, sourceSurface: "status_check",
  })).attributed, true);

  const failedReceipt = receipt(requester, {
    outcome: "failure", toolVersion: "0.0.1-smoke", clientVersion: "0.0.1-smoke",
    resolutionKind: "none", suffix: "failed-attempt",
  });
  const failed = await request("/api/exchange/working-route-comps", {
    method: "POST",
    account: requester,
    body: failedReceipt,
  });
  assert.equal(failed.status, "accepted");
  assert.ok(failed.creditsAwarded >= 1);
  await lifecycle(requester, "contribution_accepted");
  await lifecycle(requester, "credit_earned");

  await writeState(localConfigPath, {
    localOutcomes: [localOutcomeFromReceipt(failedReceipt)],
    creditBalance: failed.creditsAwarded,
  });
  const layered = await runLayeredPreflight({
    configPath: localConfigPath,
    config: { baseUrl, apiKey: requester.apiKey },
    query: {
      schema: "agentwex.preflight-query.v0.1",
      toolRegistry: "mcp", toolId: smokeToolId, toolVersion: "0.0.1-smoke",
      clientId: "agentwex-live-smoke", clientVersion: "0.0.1-smoke",
      environment: "other", authMode: "none", operation: "production-lifecycle-smoke",
      maxAgeDays: 1, minimumIndependentRoots: 2, unlock: false,
    },
  });
  assert.equal(layered.localRecall.sampleCount, 1);
  assert.equal(layered.localRecall.establishesNetworkSupport, false);
  assert.deepEqual((await readState(localConfigPath)).sentMilestones, ["preflight_run", "local_recall_hit"]);

  const query = await request("/api/exchange/queries", {
    method: "POST",
    account: requester,
    body: {
      toolRegistry: "mcp",
      toolId: smokeToolId,
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
  assert.ok(
    ["BOUNTY_OPEN", "SEEK_MORE_INDEPENDENT_RUNS"].includes(query.status),
    `unexpected initial query status: ${query.status}`,
  );

  const support = [];
  for (const [account, suffix] of [[requester, "success-a"], [second, "success-b"]]) {
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
    support.push(contribution);
  }

  const completed = await request(`/api/exchange/queries/${query.queryId}`, { account: requester });
  assert.equal(completed.status, "RESULT_AVAILABLE", JSON.stringify({ completed, support }));
  assert.equal(completed.evidence.distinctSignedNodeSupport, 2);

  const access = await request("/api/exchange/unlock", {
    method: "POST", account: requester, body: { resultId: completed.resultId },
  });
  assert.equal(access.creditsSpent, 1);
  assert.equal(access.routeReceipt.gateRequired, true);
  assert.equal(access.routeReceipt.authorityGranted, false);
  await lifecycle(requester, "route_unlocked");

  const feedback = await request("/api/exchange/route-feedback", {
    method: "POST",
    account: requester,
    body: { schema: "agentwex.route-feedback.v0.1", resultId: completed.resultId, outcome: "succeeded", attemptsAvoided: 1 },
  });
  assert.equal(feedback.outcome, "succeeded");
  await lifecycle(requester, "route_outcome_reported");

  const rotated = await request("/api/exchange/api-keys/rotate", { method: "POST", account: requester });
  requester.apiKey = rotated.apiKey;
  assert.equal((await request("/api/exchange/account", { account: requester })).id, requester.agentId);

  console.log("Live lifecycle passed: attributed install, ready state, private local recall, layered preflight, accepted contribution, earned credit, two-node support, unlock, feedback, and rotation.");
} finally {
  for (const account of accounts) {
    try { await request("/api/exchange/account", { method: "DELETE", account }); }
    catch { /* Cleanup is best-effort; a failed lifecycle still reports its original assertion. */ }
  }
  await rm(localDirectory, { recursive: true, force: true });
}
