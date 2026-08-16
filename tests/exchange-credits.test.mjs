import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { creditsForAcceptedContribution } from "../db/credits.mjs";
import {
  acceptContribution,
  createRouteQuery,
  ensureExchangeSchema,
  getAgentAccount,
  listOpenRouteBounties,
  reserveResultAccess,
  signupAgent,
  submitContribution,
  submitWorkingRouteComp,
  validateRouteQuery,
  validateSignup,
  validateWorkingRouteComp,
} from "../db/exchange-store.mjs";
import { exchangeSchemaStatements } from "../db/schema.mjs";

function d1TestDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const prepare = (sql) => ({
    _values: [],
    bind(...values) {
      this._values = values;
      return this;
    },
    first() {
      return sqlite.prepare(sql).get(...this._values) ?? null;
    },
    all() {
      return { results: sqlite.prepare(sql).all(...this._values) };
    },
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

const signupBody = {
  agent: { name: "Scout 17", identityProvider: "moltbook", externalSubject: "scout-17" },
  participation: { heartbeatMinutes: 15, deliveryChannel: "agentmail", dailyCreditSpendLimit: 10 },
};

test("credit schedule rewards only accepted independently additive contributions", () => {
  assert.equal(creditsForAcceptedContribution({ accepted: true, independentlyAdditive: true, freshnessDays: 5 }), 2);
  assert.equal(creditsForAcceptedContribution({ accepted: true, independentlyAdditive: true, freshnessDays: 90 }), 1);
  assert.equal(creditsForAcceptedContribution({ accepted: false, independentlyAdditive: true, freshnessDays: 5 }), 0);
  assert.equal(creditsForAcceptedContribution({ accepted: true, independentlyAdditive: false, freshnessDays: 5 }), 0);
});

test("signup validation is provider-neutral but bounded", () => {
  assert.equal(validateSignup(signupBody)?.deliveryChannel, "agentmail");
  assert.equal(validateSignup({ ...signupBody, agent: { ...signupBody.agent, identityProvider: "unknown" } }), null);
  assert.equal(validateSignup({ ...signupBody, participation: { ...signupBody.participation, heartbeatMinutes: 0 } }), null);
});

test("signup starts empty and one accepted Witness Comp earns result access", async () => {
  const db = d1TestDatabase();
  await ensureExchangeSchema(db);

  const signup = await signupAgent(db, signupBody);
  assert.equal(signup.status, 201);
  assert.equal(signup.account.creditBalance, 0);
  assert.equal(signup.account.authorityGranted, false);
  assert.match(signup.account.apiKey, /^wex_/);

  const invalidResult = await reserveResultAccess(db, signup.account.agentId, "result-floor-friction");
  assert.deepEqual(invalidResult, { ok: false, status: 400, error: "invalid_result_id" });

  const submitted = await submitContribution(db, signup.account.agentId, {
    recordKind: "observation",
    topic: "aisle-obstructions",
    provenanceRootId: "sensor-run-2026-08-15-17",
    independenceBasis: "attested",
    freshnessDays: 1,
  });
  assert.equal(submitted.contribution.status, "pending");
  assert.equal(submitted.contribution.creditsAwarded, 0);

  const accepted = await acceptContribution(db, {
    contributionId: submitted.contribution.contributionId,
    verifierReceiptId: "receipt-independent-17",
    independentlyAdditive: true,
    freshnessDays: 1,
  });
  assert.equal(accepted.creditsAwarded, 2);
  assert.equal((await getAgentAccount(db, signup.account.agentId)).creditBalance, 2);

  assert.equal((await getAgentAccount(db, signup.account.agentId)).creditBalance, 2);
});

test("D1 schema is composed of one prepared statement at a time", () => {
  assert.ok(exchangeSchemaStatements.length >= 6);
  assert.ok(exchangeSchemaStatements.every((statement) => !statement.trim().endsWith(";")));
  assert.ok(exchangeSchemaStatements.some((statement) => statement.includes("exchange_agents")));
  assert.ok(exchangeSchemaStatements.some((statement) => statement.includes("exchange_credit_entries")));
  assert.ok(exchangeSchemaStatements.some((statement) => statement.includes("exchange_route_queries")));
  assert.ok(exchangeSchemaStatements.some((statement) => statement.includes("exchange_working_route_comps")));
});

const routeQuery = {
  toolRegistry: "mcp",
  toolId: "io.github.example/github-mcp",
  attemptedToolVersion: "3.1.0",
  clientId: "claude-code",
  attemptedClientVersion: "1.7.0",
  environment: "macos-arm64",
  authMode: "oauth-pkce",
  operation: "repository-search",
  localEvidenceStatus: "insufficient",
  localEvidenceReceiptHash: "sha256:abcd1234",
  maxAgeDays: 7,
  minimumIndependentRoots: 2,
};

const routeComp = {
  toolRegistry: routeQuery.toolRegistry,
  toolId: routeQuery.toolId,
  toolVersion: "3.2.0",
  clientId: routeQuery.clientId,
  clientVersion: "1.8.0",
  environment: routeQuery.environment,
  authMode: routeQuery.authMode,
  operation: routeQuery.operation,
  outcome: "success",
  errorClass: null,
  resolutionKind: "upgrade-client-and-tool",
  routeFingerprint: "sha256:a1b2c3d4",
  observedAt: new Date().toISOString(),
  provenanceRootId: "independent-run-a",
  independenceBasis: "attested",
};

test("working-route validation rejects private tool content", () => {
  assert.equal(validateRouteQuery(routeQuery)?.localEvidenceStatus, "insufficient");
  assert.equal(validateRouteQuery({ ...routeQuery, localEvidenceStatus: "sufficient" }), null);
  assert.equal(validateRouteQuery({ ...routeQuery, prompt: "private task" }), null);
  assert.equal(validateRouteQuery({ ...routeQuery, toolId: "https://internal.example/tool" }), null);
  assert.equal(validateRouteQuery({ ...routeQuery, toolRegistry: "private-catalog" }), null);
  assert.equal(validateWorkingRouteComp(routeComp)?.outcome, "success");
  assert.equal(validateWorkingRouteComp({ ...routeComp, toolArguments: { repository: "private" } }), null);
  assert.equal(validateWorkingRouteComp({ ...routeComp, credentials: "secret" }), null);
  assert.equal(validateWorkingRouteComp({ ...routeComp, schema: "wrong.schema" }), null);
});

test("an empty query opens a bounty and two accepted independent comps complete it", async () => {
  const db = d1TestDatabase();
  await ensureExchangeSchema(db);
  const requester = await signupAgent(db, signupBody);
  const firstContributor = await signupAgent(db, {
    ...signupBody,
    agent: { ...signupBody.agent, name: "Route Agent A", externalSubject: "route-agent-a" },
  });
  const secondContributor = await signupAgent(db, {
    ...signupBody,
    agent: { ...signupBody.agent, name: "Route Agent B", externalSubject: "route-agent-b" },
  });

  const opened = await createRouteQuery(db, requester.account.agentId, routeQuery);
  assert.equal(opened.query.status, "BOUNTY_OPEN");
  assert.equal(opened.query.resultSealed, false);
  const openBounties = await listOpenRouteBounties(db);
  assert.equal(openBounties.length, 1);
  assert.equal("agentId" in openBounties[0], false);
  assert.equal("localEvidenceReceiptHash" in openBounties[0], false);

  const missingQuery = await submitWorkingRouteComp(db, firstContributor.account.agentId, { ...routeComp, queryId: "routeq_missing" });
  assert.equal(missingQuery.status, 404);

  const first = await submitWorkingRouteComp(db, firstContributor.account.agentId, { ...routeComp, queryId: opened.query.queryId });
  assert.equal(first.contribution.creditsAwarded, 0);
  assert.equal(first.contribution.sensitivePayloadStored, false);
  const firstAcceptance = await acceptContribution(db, {
    contributionId: first.contribution.contributionId,
    verifierReceiptId: "receipt-route-a",
    independentlyAdditive: true,
    freshnessDays: 0,
  });
  assert.equal(firstAcceptance.queryStatus, "SEEK_MORE_INDEPENDENT_RUNS");

  const second = await submitWorkingRouteComp(db, secondContributor.account.agentId, {
    ...routeComp,
    queryId: opened.query.queryId,
    provenanceRootId: "independent-run-b",
  });
  const secondAcceptance = await acceptContribution(db, {
    contributionId: second.contribution.contributionId,
    verifierReceiptId: "receipt-route-b",
    independentlyAdditive: true,
    freshnessDays: 0,
  });
  assert.equal(secondAcceptance.queryStatus, "RESULT_AVAILABLE");
  assert.equal((await listOpenRouteBounties(db)).length, 0);

  const matched = await createRouteQuery(db, requester.account.agentId, routeQuery);
  assert.equal(matched.query.queryId, opened.query.queryId);
  assert.equal(matched.query.idempotentReplay, true);
  assert.equal(matched.query.status, "RESULT_AVAILABLE");
  assert.equal(matched.query.resultSealed, true);
  assert.equal(matched.query.evidence.successfulIndependentRoots, 2);
  assert.equal("workingRoute" in matched.query, false);

  const creditedQuery = await createRouteQuery(db, firstContributor.account.agentId, routeQuery);
  assert.equal(creditedQuery.query.status, "RESULT_AVAILABLE");
  const unlocked = await reserveResultAccess(db, firstContributor.account.agentId, creditedQuery.query.resultId);
  assert.equal(unlocked.access.creditsSpent, 1);
  assert.equal(unlocked.access.creditBalance, 1);
  assert.equal(unlocked.access.releaseStatus, "READY_FOR_BOUND_AUTHORIZATION");
  assert.equal(unlocked.access.authorityGranted, false);
  assert.equal(unlocked.access.routeReceipt.workingRoute.toolVersion, "3.2.0");
  assert.equal(unlocked.access.routeReceipt.gateRequired, true);

  const duplicate = await reserveResultAccess(db, firstContributor.account.agentId, creditedQuery.query.resultId);
  assert.deepEqual(duplicate, { ok: false, status: 409, error: "result_already_unlocked" });
});
