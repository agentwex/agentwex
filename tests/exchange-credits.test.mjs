import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { creditsForAcceptedContribution } from "../db/credits.mjs";
import {
  acceptContribution,
  createRouteQuery,
  enrollLabParticipant,
  ensureExchangeSchema,
  getAgentAccount,
  listAgentContributions,
  listOpenRouteBounties,
  reserveResultAccess,
  runPreflight,
  signupAgent,
  submitContribution,
  submitRouteFeedback,
  submitWorkingRouteComp,
  validatePreflight,
  validateRouteFeedback,
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
  assert.equal(validateRouteQuery({
    ...routeQuery,
    schema: "agentwex.working-route-query.v0.2",
    capabilityId: "repository.search",
    effectClass: "read",
    alternativePolicy: "same-capability",
  })?.alternativePolicy, "same-capability");
  assert.equal(validateRouteQuery({
    ...routeQuery,
    schema: "agentwex.working-route-query.v0.2",
    capabilityId: "repository.search",
    alternativePolicy: "same-capability",
  }), null);
  assert.equal(validateRouteQuery({
    ...routeQuery,
    schema: "agentwex.working-route-query.v0.2",
    capabilityId: "repository.search",
    effectClass: "read",
    alternativePolicy: "same-capability",
    prompt: "private task",
  }), null);
  assert.equal(validateWorkingRouteComp({
    ...routeComp,
    schema: "agentwex.working-route-comp.v0.3",
    capabilityId: "repository.search",
    effectClass: "read",
    attestation: {
      algorithm: "Ed25519",
      keyId: "wexkey_1234567890abcdef12345678",
      signature: "a".repeat(64),
    },
  })?.capabilityId, "repository.search");
  assert.equal(validateWorkingRouteComp({
    ...routeComp,
    schema: "agentwex.working-route-comp.v0.3",
    capabilityId: "repository.search",
    effectClass: "write",
    attestation: {
      algorithm: "Ed25519",
      keyId: "wexkey_1234567890abcdef12345678",
      signature: "a".repeat(64),
    },
  })?.effectClass, "write");
  assert.equal(validatePreflight({
    toolRegistry: routeComp.toolRegistry,
    toolId: routeComp.toolId,
    toolVersion: routeComp.toolVersion,
    clientId: routeComp.clientId,
    clientVersion: routeComp.clientVersion,
    environment: routeComp.environment,
    authMode: routeComp.authMode,
    operation: routeComp.operation,
  })?.minimumSignedNodes, 2);
  assert.equal(validateRouteFeedback({ resultId: "working-route:routeq_abc123", outcome: "succeeded" })?.attemptsAvoided, 0);
  assert.equal(validateRouteFeedback({ resultId: "working-route:routeq_abc123", outcome: "failed" }), null);
  assert.equal(validateRouteFeedback({ resultId: "working-route:routeq_abc123", outcome: "failed", failureClass: "one-off-private-detail" }), null);
  assert.equal(validateRouteFeedback({ resultId: "working-route:routeq_abc123", outcome: "failed", failureClass: "compatibility" })?.failureClass, "compatibility");
});

test("two enrolled lab participants unlock only a visibly provisional first-party route", async () => {
  const db = d1TestDatabase();
  await ensureExchangeSchema(db);
  const requester = await signupAgent(db, {
    ...signupBody,
    agent: { ...signupBody.agent, name: "Lab Requester", externalSubject: "lab-requester" },
  });
  const first = await signupAgent(db, {
    ...signupBody,
    agent: { ...signupBody.agent, name: "Lab A", externalSubject: "lab-a" },
  });
  const second = await signupAgent(db, {
    ...signupBody,
    agent: { ...signupBody.agent, name: "Lab B", externalSubject: "lab-b" },
  });
  for (const [account, participantId] of [[first.account, "lab-macos-a"], [second.account, "lab-macos-b"]]) {
    const enrolled = await enrollLabParticipant(db, {
      agentId: account.agentId, controllerGroupId: "agentwex-first-party-lab", participantId,
    });
    assert.equal(enrolled.status, 201);
  }
  const credit = await submitContribution(db, requester.account.agentId, {
    recordKind: "tool-result", topic: "lab-route-request", provenanceRootId: "lab-request-credit",
    independenceBasis: "attested", freshnessDays: 0,
  });
  await acceptContribution(db, {
    contributionId: credit.contribution.contributionId,
    verifierReceiptId: "lab-request-credit-verifier",
    independentlyAdditive: true,
  });
  for (const [account, suffix] of [[first.account, "a"], [second.account, "b"]]) {
    const submitted = await submitWorkingRouteComp(db, account.agentId, {
      ...routeComp, provenanceRootId: `lab-route-${suffix}`,
    });
    assert.equal(submitted.status, 202);
    await acceptContribution(db, {
      contributionId: submitted.contribution.contributionId,
      verifierReceiptId: `lab-route-verifier-${suffix}`,
      independentlyAdditive: true,
    });
  }
  const query = await createRouteQuery(db, requester.account.agentId, routeQuery);
  assert.equal(query.query.status, "LAB_RESULT_AVAILABLE");
  assert.equal(query.query.resultSealed, true);
  const access = await reserveResultAccess(db, requester.account.agentId, query.query.resultId);
  assert.equal(access.status, 200);
  assert.equal(access.access.routeReceipt.workingRoute.supportStatus, "lab-observed");
  assert.equal(access.access.routeReceipt.workingRoute.distinctControllerGroupCount, 1);
  assert.equal(access.access.routeReceipt.workingRoute.distinctParticipantCount, 2);
  assert.equal(access.access.routeReceipt.workingRoute.controllerIndependenceVerified, false);
});

test("preflight seals a supported alternative, spends one earned credit on unlock, and records bounded impact feedback", async () => {
  const db = d1TestDatabase();
  await ensureExchangeSchema(db);
  const requester = await signupAgent(db, {
    ...signupBody,
    agent: { ...signupBody.agent, name: "Preflight Requester", externalSubject: "preflight-requester" },
  });
  const firstContributor = await signupAgent(db, {
    ...signupBody,
    agent: { ...signupBody.agent, name: "Preflight Route A", externalSubject: "preflight-route-a" },
  });
  const secondContributor = await signupAgent(db, {
    ...signupBody,
    agent: { ...signupBody.agent, name: "Preflight Route B", externalSubject: "preflight-route-b" },
  });
  const creditSource = await submitContribution(db, requester.account.agentId, {
    recordKind: "tool-result",
    topic: "public-preflight-participation",
    provenanceRootId: "preflight-requester-credit-root",
    independenceBasis: "attested",
    freshnessDays: 0,
  });
  await acceptContribution(db, {
    contributionId: creditSource.contribution.contributionId,
    verifierReceiptId: "preflight-requester-credit-receipt",
    independentlyAdditive: true,
  });

  const first = await submitWorkingRouteComp(db, firstContributor.account.agentId, {
    ...routeComp,
    queryId: undefined,
    provenanceRootId: "preflight-supported-route-a",
  });
  await acceptContribution(db, {
    contributionId: first.contribution.contributionId,
    verifierReceiptId: "preflight-supported-receipt-a",
    independentlyAdditive: true,
  });
  const second = await submitWorkingRouteComp(db, secondContributor.account.agentId, {
    ...routeComp,
    queryId: undefined,
    provenanceRootId: "preflight-supported-route-b",
  });
  await acceptContribution(db, {
    contributionId: second.contribution.contributionId,
    verifierReceiptId: "preflight-supported-receipt-b",
    independentlyAdditive: true,
  });

  const preflightBody = {
    schema: "agentwex.preflight-query.v0.1",
    toolRegistry: routeComp.toolRegistry,
    toolId: routeComp.toolId,
    toolVersion: "3.1.0",
    clientId: routeComp.clientId,
    clientVersion: "1.7.0",
    environment: routeComp.environment,
    authMode: routeComp.authMode,
    operation: routeComp.operation,
    maxAgeDays: 7,
    minimumSignedNodes: 2,
    unlock: false,
  };
  const sealed = await runPreflight(db, requester.account.agentId, preflightBody);
  assert.equal(sealed.status, 200);
  assert.equal(sealed.assessment.recommendation.action, "UNLOCK_SUPPORTED_ROUTE");
  assert.equal(sealed.assessment.recommendation.routeDetailsSealed, true);
  assert.equal(sealed.assessment.routeQuery.status, "RESULT_AVAILABLE");
  assert.equal("routeAccess" in sealed.assessment, false);

  const unlocked = await runPreflight(db, requester.account.agentId, { ...preflightBody, unlock: true });
  assert.equal(unlocked.assessment.recommendation.routeDetailsSealed, false);
  assert.equal(unlocked.assessment.routeAccess.creditsSpent, 1);
  assert.equal(unlocked.assessment.routeAccess.routeReceipt.workingRoute.toolVersion, routeComp.toolVersion);
  assert.equal(unlocked.assessment.routeAccess.routeReceipt.gateRequired, true);
  assert.equal((await getAgentAccount(db, requester.account.agentId)).creditBalance, 1);

  const feedback = await submitRouteFeedback(db, requester.account.agentId, {
    schema: "agentwex.route-feedback.v0.1",
    resultId: unlocked.assessment.routeAccess.resultId,
    outcome: "succeeded",
    attemptsAvoided: 2,
    estimatedTokensAvoided: 4000,
    estimatedLatencyMsAvoided: 15000,
  });
  assert.equal(feedback.status, 201);
  assert.equal(feedback.feedback.attemptsAvoided, 2);
  const replay = await submitRouteFeedback(db, requester.account.agentId, {
    resultId: unlocked.assessment.routeAccess.resultId,
    outcome: "succeeded",
    attemptsAvoided: 2,
    estimatedTokensAvoided: 4000,
    estimatedLatencyMsAvoided: 15000,
  });
  assert.equal(replay.feedback.idempotentReplay, true);
  const conflictingReplay = await submitRouteFeedback(db, requester.account.agentId, {
    resultId: unlocked.assessment.routeAccess.resultId,
    outcome: "not-attempted",
  });
  assert.deepEqual(conflictingReplay, { ok: false, status: 409, error: "route_feedback_already_recorded" });
  const crossAccount = await submitRouteFeedback(db, firstContributor.account.agentId, {
    resultId: unlocked.assessment.routeAccess.resultId,
    outcome: "succeeded",
  });
  assert.equal(crossAccount.status, 404);

  const repeated = await runPreflight(db, requester.account.agentId, { ...preflightBody, unlock: true });
  assert.equal(repeated.assessment.routeAccess.alreadyUnlocked, true);
  assert.equal(repeated.assessment.routeAccess.creditsSpent, 0);
  assert.equal(repeated.assessment.candidateSummary.feedbackImpact.attemptsAvoided, 2);
  assert.equal((await getAgentAccount(db, requester.account.agentId)).creditBalance, 1);
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
  const firstHistory = await listAgentContributions(db, firstContributor.account.agentId, { limit: 25 });
  assert.equal(firstHistory.total, 1);
  assert.equal(firstHistory.contributions[0].toolId, routeComp.toolId);
  assert.equal(firstHistory.contributions[0].clientId, routeComp.clientId);
  assert.equal(firstHistory.contributions[0].outcome, "success");
  assert.equal(firstHistory.contributions[0].creditsAwarded, 2);
  assert.equal(firstHistory.contributions[0].sensitivePayloadStored, false);
  assert.equal("provenanceRootId" in firstHistory.contributions[0], false);
  assert.equal("routeFingerprint" in firstHistory.contributions[0], false);

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

test("navigator query retrieves a supported route from a different tool with the same capability and effect", async () => {
  const db = d1TestDatabase();
  await ensureExchangeSchema(db);
  const requester = await signupAgent(db, {
    ...signupBody,
    agent: { ...signupBody.agent, name: "Navigator requester", externalSubject: "navigator-requester" },
  });
  const createdAt = new Date().toISOString();
  for (const [agentId, suffix] of [["agent_nav_a", "a"], ["agent_nav_b", "b"]]) {
    await db.prepare(`INSERT INTO exchange_agents
      (id, name, identity_provider, external_subject, api_key_hash, heartbeat_minutes, delivery_channel, status, created_at)
      VALUES (?, ?, 'custom', ?, ?, 15, 'nexus-api', 'active', ?)`)
      .bind(agentId, `Navigator ${suffix}`, `navigator-${suffix}`, `hash-${suffix}`, createdAt).run();
    await db.prepare(`INSERT INTO exchange_contributions
      (id, agent_id, record_kind, topic, provenance_root_id, independence_basis, freshness_days, status, created_at, accepted_at)
      VALUES (?, ?, 'working-route', 'repository.search', ?, 'attested', 0, 'accepted', ?, ?)`)
      .bind(`comp_nav_${suffix}`, agentId, `root-nav-${suffix}`, createdAt, createdAt).run();
    await db.prepare(`INSERT INTO exchange_working_route_comps
      (contribution_id, tool_registry, tool_id, tool_version, client_id, client_version, environment,
       auth_mode, operation, capability_id, effect_class, outcome, error_class, resolution_kind, route_fingerprint, observed_at)
      VALUES (?, 'github', 'gh-cli', '2.80.0', 'shell', '1.0.0', 'macos-arm64',
       'api-key', 'repo-search', 'repository.search', 'read', 'success', NULL, 'alternate-tool', 'sha256:navigator-route', ?)`)
      .bind(`comp_nav_${suffix}`, createdAt).run();
  }

  const opened = await createRouteQuery(db, requester.account.agentId, {
    ...routeQuery,
    schema: "agentwex.working-route-query.v0.2",
    capabilityId: "repository.search",
    effectClass: "read",
    alternativePolicy: "same-capability",
    localEvidenceReceiptHash: "sha256:abcd5678",
  });

  assert.equal(opened.query.status, "RESULT_AVAILABLE");
  assert.equal(opened.query.evidence.distinctSignedNodeSupport, 2);
});
