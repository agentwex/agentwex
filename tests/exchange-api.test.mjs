import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { handleExchangeApi } from "../db/exchange-api.mjs";
import { ensureExchangeSchema } from "../db/exchange-store.mjs";

function d1TestDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const prepare = (sql) => ({
    _values: [],
    bind(...values) { this._values = values; return this; },
    first() { return sqlite.prepare(sql).get(...this._values) ?? null; },
    all() { return { results: sqlite.prepare(sql).all(...this._values) }; },
    run() {
      const result = sqlite.prepare(sql).run(...this._values);
      return { meta: { changes: Number(result.changes) } };
    },
  });
  return {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function apiRequest(path, { method = "GET", token, body, headers = {} } = {}) {
  return new Request(`https://awe.test${path}`, {
    method,
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("schema setup upgrades a legacy preview database before navigator indexes are created", async () => {
  const db = d1TestDatabase();
  await db.prepare(`CREATE TABLE exchange_agents (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, identity_provider TEXT NOT NULL,
    external_subject TEXT NOT NULL, api_key_hash TEXT NOT NULL,
    heartbeat_minutes INTEGER NOT NULL, delivery_channel TEXT NOT NULL,
    daily_credit_spend_limit INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE exchange_working_route_comps (
    contribution_id TEXT PRIMARY KEY, query_id TEXT, tool_registry TEXT NOT NULL,
    tool_id TEXT NOT NULL, tool_version TEXT NOT NULL, client_id TEXT NOT NULL,
    client_version TEXT NOT NULL, environment TEXT NOT NULL, auth_mode TEXT NOT NULL,
    operation TEXT NOT NULL, outcome TEXT NOT NULL, error_class TEXT,
    resolution_kind TEXT NOT NULL, route_fingerprint TEXT NOT NULL, observed_at TEXT NOT NULL
  )`).run();

  await ensureExchangeSchema(db);
  const columns = await db.prepare("PRAGMA table_info(exchange_working_route_comps)").all();
  assert.ok(columns.results.some((column) => column.name === "capability_id"));
  assert.ok(columns.results.some((column) => column.name === "effect_class"));
  const index = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_exchange_working_route_capability'").first();
  assert.equal(index.name, "idx_exchange_working_route_capability");
  const genesis = await db.prepare("SELECT genesis_kind AS genesisKind, assurance_level AS assuranceLevel FROM exchange_agent_genesis").first();
  assert.equal(genesis, null);
});

test("signup issues immutable genesis and the private owner snapshot explains fleet accounting", async () => {
  const db = d1TestDatabase();
  const ownerEmail = "owner@example.test";
  const signupResponse = await handleExchangeApi(apiRequest("/api/exchange/signup", {
    method: "POST",
    body: {
      agent: { name: "Genesis Node", identityProvider: "custom", externalSubject: "genesis-node" },
      participation: { heartbeatMinutes: 15, deliveryChannel: "nexus-api", dailyCreditSpendLimit: 10 },
    },
  }), db, { ownerEmail });
  assert.equal(signupResponse.status, 201);
  const signup = await signupResponse.json();
  assert.match(signup.genesisId, /^genesis_[a-f0-9]{32}$/);
  assert.equal(signup.genesisAssurance, "exchange-issued-v1");

  const stored = await db.prepare(`SELECT genesis_kind AS genesisKind, derivation_type AS derivationType,
      assurance_level AS assuranceLevel, record_digest AS recordDigest
    FROM exchange_agent_genesis WHERE agent_id = ?`).bind(signup.agentId).first();
  assert.equal(stored.genesisKind, "exchange-registration");
  assert.equal(stored.derivationType, "unreported");
  assert.equal(stored.assuranceLevel, "exchange-issued-v1");
  assert.match(stored.recordDigest, /^sha256:[a-f0-9]{64}$/);

  const denied = await handleExchangeApi(apiRequest("/api/exchange/internal/owner-snapshot"), db, { ownerEmail });
  assert.equal(denied.status, 403);

  const allowed = await handleExchangeApi(apiRequest("/api/exchange/internal/owner-snapshot", {
    headers: { "oai-authenticated-user-email": ownerEmail },
  }), db, { ownerEmail, ownerAliases: { [signup.agentId]: "Owner Mac" } });
  assert.equal(allowed.status, 200);
  const snapshot = await allowed.json();
  assert.equal(snapshot.schema, "agentwex.owner-snapshot.v0.1");
  assert.equal(snapshot.summary.activeNodes, 1);
  assert.equal(snapshot.summary.genesisRecords, 1);
  assert.equal(snapshot.nodes[0].ownerLabel, "Owner Mac");
  assert.equal(snapshot.nodes[0].genesisKind, "exchange-registration");
  assert.equal(snapshot.boundaries.genesisProvesConsciousness, false);
  assert.equal(snapshot.boundaries.genesisProvesIndependentControl, false);
  assert.equal(snapshot.boundaries.authorityGranted, false);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /api_key_hash|public_key_spki|provenance_root_id|signature/i);
});

test("first node can submit idempotently, await verification, and earn durable credits", async () => {
  const db = d1TestDatabase();
  const verifierToken = "verifier_test_secret_123456789";
  const signupResponse = await handleExchangeApi(apiRequest("/api/exchange/signup", {
    method: "POST",
    body: {
      agent: { name: "First Node", identityProvider: "custom", externalSubject: "first-node" },
      participation: { heartbeatMinutes: 15, deliveryChannel: "nexus-api", dailyCreditSpendLimit: 10 },
    },
  }), db, { verifierToken });
  assert.equal(signupResponse.status, 201);
  const signup = await signupResponse.json();
  assert.equal(signup.creditBalance, 0);

  const contributionBody = {
    recordKind: "tool-result",
    topic: "public-tool-compatibility",
    provenanceRootId: "first-node-run-0001",
    independenceBasis: "attested",
    freshnessDays: 0,
  };
  const submittedResponse = await handleExchangeApi(apiRequest("/api/exchange/contributions", {
    method: "POST", token: signup.apiKey, body: contributionBody,
  }), db, { verifierToken });
  assert.equal(submittedResponse.status, 202);
  const submitted = await submittedResponse.json();

  const replayResponse = await handleExchangeApi(apiRequest("/api/exchange/contributions", {
    method: "POST", token: signup.apiKey, body: contributionBody,
  }), db, { verifierToken });
  assert.equal(replayResponse.status, 200);
  const replay = await replayResponse.json();
  assert.equal(replay.contributionId, submitted.contributionId);
  assert.equal(replay.idempotentReplay, true);

  const pendingResponse = await handleExchangeApi(apiRequest(`/api/exchange/contributions/${submitted.contributionId}`, {
    token: signup.apiKey,
  }), db, { verifierToken });
  assert.equal(pendingResponse.status, 200);
  assert.equal((await pendingResponse.json()).status, "pending");

  const deniedVerification = await handleExchangeApi(apiRequest("/api/exchange/internal/accept", {
    method: "POST", token: "wrong-token", body: {
      contributionId: submitted.contributionId,
      verifierReceiptId: "verifier:first-node-run-0001",
      independentlyAdditive: true,
    },
  }), db, { verifierToken });
  assert.equal(deniedVerification.status, 401);

  const acceptedResponse = await handleExchangeApi(apiRequest("/api/exchange/internal/accept", {
    method: "POST", token: verifierToken, body: {
      contributionId: submitted.contributionId,
      verifierReceiptId: "verifier:first-node-run-0001",
      independentlyAdditive: true,
      reason: "reproduced_public_tool_outcome",
    },
  }), db, { verifierToken });
  assert.equal(acceptedResponse.status, 200);
  assert.equal((await acceptedResponse.json()).creditsAwarded, 2);

  const acceptedStatus = await handleExchangeApi(apiRequest(`/api/exchange/contributions/${submitted.contributionId}`, {
    token: signup.apiKey,
  }), db, { verifierToken });
  const contribution = await acceptedStatus.json();
  assert.equal(contribution.status, "accepted");
  assert.equal(contribution.creditsAwarded, 2);
  assert.equal(contribution.verificationDecision, "accepted");
  assert.equal(contribution.verificationReason, "reproduced_public_tool_outcome");
  assert.equal(contribution.sensitivePayloadStored, false);

  const historyResponse = await handleExchangeApi(apiRequest("/api/exchange/contributions?limit=1&offset=0", {
    token: signup.apiKey,
  }), db, { verifierToken });
  assert.equal(historyResponse.status, 200);
  const history = await historyResponse.json();
  assert.equal(history.total, 1);
  assert.equal(history.limit, 1);
  assert.equal(history.offset, 0);
  assert.equal(history.hasMore, false);
  assert.equal(history.contributions[0].contributionId, submitted.contributionId);
  assert.equal(history.contributions[0].creditsAwarded, 2);
  assert.equal(history.contributions[0].verificationReason, "reproduced_public_tool_outcome");
  assert.equal("provenanceRootId" in history.contributions[0], false);

  const otherSignupResponse = await handleExchangeApi(apiRequest("/api/exchange/signup", {
    method: "POST",
    body: {
      agent: { name: "Other Node", identityProvider: "custom", externalSubject: "other-node" },
      participation: { heartbeatMinutes: 15, deliveryChannel: "nexus-api", dailyCreditSpendLimit: 10 },
    },
  }), db, { verifierToken });
  const otherSignup = await otherSignupResponse.json();
  const otherHistory = await handleExchangeApi(apiRequest("/api/exchange/contributions", {
    token: otherSignup.apiKey,
  }), db, { verifierToken });
  assert.equal((await otherHistory.json()).total, 0);
  const crossAccountDetail = await handleExchangeApi(apiRequest(`/api/exchange/contributions/${submitted.contributionId}`, {
    token: otherSignup.apiKey,
  }), db, { verifierToken });
  assert.equal(crossAccountDetail.status, 404);

  const accountResponse = await handleExchangeApi(apiRequest("/api/exchange/account", { token: signup.apiKey }), db, { verifierToken });
  assert.equal((await accountResponse.json()).creditBalance, 2);

  const ledgerResponse = await handleExchangeApi(apiRequest("/api/exchange/ledger", { token: signup.apiKey }), db, { verifierToken });
  assert.equal(ledgerResponse.status, 200);
  const ledger = await ledgerResponse.json();
  assert.equal(ledger.immutable, true);
  assert.equal(ledger.creditBalance, 2);
  assert.equal(ledger.entries.length, 1);
  assert.equal(ledger.entries[0].entryType, "earn");
  assert.equal(ledger.entries[0].balanceAfter, 2);
});

test("public API bounds bodies, throttles signup fingerprints, rotates keys, and deactivates accounts", async () => {
  const db = d1TestDatabase();
  const oversized = await handleExchangeApi(new Request("https://awe.test/api/exchange/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(70_000) }),
  }), db, { clientFingerprint: "oversized-test", requireClientFingerprint: true });
  assert.equal(oversized.status, 413);

  let account;
  for (let index = 0; index < 6; index += 1) {
    const response = await handleExchangeApi(apiRequest("/api/exchange/signup", {
      method: "POST",
      body: {
        agent: { name: `Rate Node ${index}`, identityProvider: "custom", externalSubject: `rate-node-${index}` },
        participation: { heartbeatMinutes: 15, deliveryChannel: "nexus-api", dailyCreditSpendLimit: 10 },
      },
    }), db, { clientFingerprint: "same-network-client", requireClientFingerprint: true });
    if (index < 5) {
      assert.equal(response.status, 201);
      if (index === 0) account = await response.json();
    } else {
      assert.equal(response.status, 429);
      assert.ok(Number(response.headers.get("retry-after")) > 0);
    }
  }

  const alerts = await handleExchangeApi(apiRequest("/api/exchange/alerts?limit=10", { token: account.apiKey }), db);
  assert.equal(alerts.status, 200);
  assert.deepEqual((await alerts.json()).alerts, []);
  const invalidPreflight = await handleExchangeApi(apiRequest("/api/exchange/preflight", {
    method: "POST", token: account.apiKey, body: { schema: "agentwex.preflight-query.v0.1" },
  }), db);
  assert.equal(invalidPreflight.status, 400);
  const invalidFeedback = await handleExchangeApi(apiRequest("/api/exchange/route-feedback", {
    method: "POST", token: account.apiKey, body: { outcome: "succeeded" },
  }), db);
  assert.equal(invalidFeedback.status, 400);

  const rotatedResponse = await handleExchangeApi(apiRequest("/api/exchange/api-keys/rotate", {
    method: "POST", token: account.apiKey,
  }), db);
  assert.equal(rotatedResponse.status, 200);
  const rotated = await rotatedResponse.json();
  assert.notEqual(rotated.apiKey, account.apiKey);
  assert.equal((await handleExchangeApi(apiRequest("/api/exchange/account", { token: account.apiKey }), db)).status, 401);
  assert.equal((await handleExchangeApi(apiRequest("/api/exchange/account", { token: rotated.apiKey }), db)).status, 200);

  const deactivated = await handleExchangeApi(apiRequest("/api/exchange/account", { method: "DELETE", token: rotated.apiKey }), db);
  assert.equal(deactivated.status, 200);
  assert.equal((await deactivated.json()).deactivated, true);
  assert.equal((await handleExchangeApi(apiRequest("/api/exchange/account", { token: rotated.apiKey }), db)).status, 401);
});

test("admin-only lab enrollment binds nodes to one controller and is idempotent", async () => {
  const db = d1TestDatabase();
  const adminToken = "admin_route_lab_secret_123456789";
  const signupResponse = await handleExchangeApi(apiRequest("/api/exchange/signup", {
    method: "POST",
    body: {
      agent: { name: "Lab Node A", identityProvider: "custom", externalSubject: "lab-node-a" },
      participation: { heartbeatMinutes: 15, deliveryChannel: "nexus-api", dailyCreditSpendLimit: 10 },
    },
  }), db, { adminToken });
  const account = await signupResponse.json();
  const body = {
    agentId: account.agentId,
    controllerGroupId: "agentwex-first-party-lab",
    participantId: "lab-macos-a",
  };

  const denied = await handleExchangeApi(apiRequest("/api/exchange/internal/lab-enroll", {
    method: "POST", token: "wrong-token", body,
  }), db, { adminToken });
  assert.equal(denied.status, 401);

  const enrolled = await handleExchangeApi(apiRequest("/api/exchange/internal/lab-enroll", {
    method: "POST", token: adminToken, body,
  }), db, { adminToken });
  assert.equal(enrolled.status, 201);
  assert.deepEqual(await enrolled.json(), { ...body, evidenceScope: "lab", idempotentReplay: false });

  const replay = await handleExchangeApi(apiRequest("/api/exchange/internal/lab-enroll", {
    method: "POST", token: adminToken, body,
  }), db, { adminToken });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).idempotentReplay, true);

  const mapping = await db.prepare(`SELECT controller_group_id AS controllerGroupId, participant_id AS participantId,
    evidence_scope AS evidenceScope FROM exchange_agent_controller_groups WHERE agent_id = ?`).bind(account.agentId).first();
  assert.deepEqual({ ...mapping }, {
    controllerGroupId: "agentwex-first-party-lab", participantId: "lab-macos-a", evidenceScope: "lab",
  });
});
