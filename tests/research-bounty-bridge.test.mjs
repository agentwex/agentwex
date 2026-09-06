import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { handleExchangeApi } from "../db/exchange-api.mjs";
import {
  publicationReceiptDigest,
  validateResearchBounty,
} from "../exchange/research-bounty-v0.1/research-bounty.mjs";

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

function request(path, { method = "GET", token, body } = {}) {
  return new Request(`https://agentwex.test${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function signup(db, subject) {
  const response = await handleExchangeApi(request("/api/exchange/signup", {
    method: "POST",
    body: {
      agent: { name: subject, identityProvider: "custom", externalSubject: subject },
      participation: { heartbeatMinutes: 15, deliveryChannel: "nexus-api", dailyCreditSpendLimit: 0 },
    },
  }), db);
  assert.equal(response.status, 201);
  return response.json();
}

async function bountyBody() {
  const body = {
    schema: "agentwex.research-bounty.v0.1",
    sourceSystem: "invention-graph",
    sourceBountyId: `igb_${"c".repeat(32)}`,
    title: "Measure a bounded material response",
    researchQuestion: "Does the intervention improve the preregistered response under the public protocol?",
    acceptanceCriteria: [
      "Publish the complete bounded protocol and observations.",
      "Measure control and intervention with the same procedure.",
    ],
    falsificationCriterion: "The intervention does not improve the preregistered response relative to control.",
    requiredObservations: 20,
    minimumIndependentRoots: 2,
    safetyConstraints: ["Use simulation or approved non-hazardous bench procedures only."],
    expiresAt: "2030-01-01T00:00:00.000Z",
    publicationReceiptDigest: `sha256:${"0".repeat(64)}`,
  };
  body.publicationReceiptDigest = await publicationReceiptDigest(body);
  return body;
}

async function communityBountyBody() {
  const body = {
    schema: "agentwex.community-research-bounty.v0.1",
    sourceSystem: "agentwex-community",
    sourceBountyId: `community_${"d".repeat(32)}`,
    title: "Independently reproduce a public environmental measurement",
    researchQuestion: "Can two declared laboratories reproduce the public measurement under the bounded protocol?",
    acceptanceCriteria: [
      "Publish the complete protocol, observations, and immutable artifact digest.",
      "Measure the declared control and intervention with the same procedure.",
    ],
    falsificationCriterion: "The intervention does not improve the preregistered response relative to control.",
    requiredObservations: 20,
    minimumIndependentRoots: 2,
    safetyConstraints: ["Use simulation or approved non-hazardous bench procedures only."],
    expiresAt: "2030-01-01T00:00:00.000Z",
    fundingGoalUsdc: "25.00",
    settlementRail: "taskmarket_escrow",
    publicationReceiptDigest: `sha256:${"0".repeat(64)}`,
  };
  body.publicationReceiptDigest = await publicationReceiptDigest(body);
  return body;
}

function fundingIntent(amount, suffix) {
  return {
    schema: "agentwex.research-bounty-funding-intent.v0.1",
    amountUsdc: amount,
    settlementRail: "taskmarket_escrow",
    idempotencyKey: `funding_${suffix.repeat(32)}`,
    externalSettlementId: `taskmarket:escrow:${suffix.repeat(16)}`,
    settlementReceiptDigest: `sha256:${suffix.repeat(64)}`,
  };
}

const communityPreviewOptions = { communityBountiesEnabled: true };

test("research bounty validation fails closed on private context and receipt tampering", async () => {
  const body = await bountyBody();
  assert.equal(body.publicationReceiptDigest, "sha256:0070a02d2d3f19d43434f6cb83282df645bc2f3db9e41b949eac4d2b02934e3c");
  assert.equal(validateResearchBounty(body)?.sourceBountyId, body.sourceBountyId);
  assert.equal(validateResearchBounty({ ...body, privateExperimentId: "experiment:secret" }), null);
  assert.equal(validateResearchBounty({ ...body, researchQuestion: "Read file:///Users/operator/private.db" }), null);

  const db = d1TestDatabase();
  const publisher = await signup(db, "invention-graph-publisher");
  const response = await handleExchangeApi(request("/api/exchange/research-bounties", {
    method: "POST",
    token: publisher.apiKey,
    body: { ...body, title: "Tampered after receipt" },
  }), db);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "publication_receipt_mismatch" });
});

test("approved public bounty crosses the bridge and quality remains review-only", async () => {
  const db = d1TestDatabase();
  const publisher = await signup(db, "invention-graph-publisher");
  const solver = await signup(db, "independent-lab-node");
  const body = await bountyBody();

  const publishedResponse = await handleExchangeApi(request("/api/exchange/research-bounties", {
    method: "POST", token: publisher.apiKey, body,
  }), db);
  assert.equal(publishedResponse.status, 201);
  const published = await publishedResponse.json();
  assert.match(published.bountyId, /^researchbounty_[a-f0-9]{32}$/);
  assert.equal(published.authorityGranted, false);

  const replayResponse = await handleExchangeApi(request("/api/exchange/research-bounties", {
    method: "POST", token: publisher.apiKey, body,
  }), db);
  assert.equal(replayResponse.status, 200);
  assert.equal((await replayResponse.json()).idempotentReplay, true);

  const listResponse = await handleExchangeApi(request("/api/exchange/research-bounties", {
    token: solver.apiKey,
  }), db);
  const listing = await listResponse.json();
  assert.equal(listing.bounties.length, 1);
  assert.equal(listing.privateGraphExposed, false);
  assert.doesNotMatch(JSON.stringify(listing), /privateExperiment|modelBindings|sourceLocator|hypothesisId/i);

  const submission = {
    schema: "agentwex.research-bounty-submission.v0.1",
    publicArtifactUrl: "https://example.org/public-results/material-response.json",
    artifactDigest: `sha256:${"b".repeat(64)}`,
    methodSummary: "Executed the published control and intervention procedure with a frozen measurement script.",
    observationCount: 20,
    criterionEvidence: [0, 1],
    provenanceRoots: ["lab-a:run-001", "lab-b:run-004"],
    reproducibilityReceiptDigest: `sha256:${"c".repeat(64)}`,
  };
  const submittedResponse = await handleExchangeApi(request(
    `/api/exchange/research-bounties/${published.bountyId}/submissions`,
    { method: "POST", token: solver.apiKey, body: submission },
  ), db);
  assert.equal(submittedResponse.status, 201);
  const submitted = await submittedResponse.json();
  assert.equal(submitted.quality.structuralScore, 100);
  assert.equal(submitted.quality.readyForHumanReview, true);
  assert.equal(submitted.quality.provenanceIndependenceVerified, false);
  assert.equal(submitted.quality.scientificValidityEstablished, false);
  assert.equal(submitted.quality.authorityGranted, false);

  const deniedQuality = await handleExchangeApi(request(
    `/api/exchange/research-bounties/${published.bountyId}/quality`,
    { token: solver.apiKey },
  ), db);
  assert.equal(deniedQuality.status, 404);

  const qualityResponse = await handleExchangeApi(request(
    `/api/exchange/research-bounties/${published.bountyId}/quality`,
    { token: publisher.apiKey },
  ), db);
  assert.equal(qualityResponse.status, 200);
  const quality = await qualityResponse.json();
  assert.equal(quality.submissionCount, 1);
  assert.equal(quality.readyForHumanReviewCount, 1);
  assert.equal(quality.averageStructuralScore, 100);
  assert.equal(quality.scientificValidityEstablished, false);
  assert.equal(quality.authorityGranted, false);
});

test("community bounty publishing and funding fail closed while coming soon", async () => {
  const db = d1TestDatabase();
  const publisher = await signup(db, "community-coming-soon-publisher");
  const body = await communityBountyBody();

  const publication = await handleExchangeApi(request("/api/exchange/research-bounties", {
    method: "POST", token: publisher.apiKey, body,
  }), db);
  assert.equal(publication.status, 503);
  assert.deepEqual(await publication.json(), {
    error: "community_bounty_funding_coming_soon",
    status: "coming_soon",
    acceptingCommunityBounties: false,
    acceptingFunds: false,
    paidClaimsAvailable: false,
    escrowReleaseAvailable: false,
  });

  const funding = await handleExchangeApi(request(
    `/api/exchange/research-bounties/researchbounty_${"a".repeat(32)}/funding-intents`,
    { method: "POST", token: publisher.apiKey, body: fundingIntent("1.00", "c") },
  ), db);
  assert.equal(funding.status, 503);

  const listing = await handleExchangeApi(request("/api/exchange/research-bounties"), db);
  const listed = await listing.json();
  assert.equal(listed.communityBountyFunding.status, "coming_soon");
  assert.equal(listed.communityBountyFunding.acceptingFunds, false);
  assert.equal(listed.communityBountyFunding.paidClaimsAvailable, false);
});

test("disabled community bounty foundation opens only after externally verified funding", async () => {
  const db = d1TestDatabase();
  const publisher = await signup(db, "community-publisher");
  const firstFunder = await signup(db, "community-funder-a");
  const secondFunder = await signup(db, "community-funder-b");
  const solver = await signup(db, "community-solver");
  const body = await communityBountyBody();

  const publishedResponse = await handleExchangeApi(request("/api/exchange/research-bounties", {
    method: "POST", token: publisher.apiKey, body,
  }), db, communityPreviewOptions);
  assert.equal(publishedResponse.status, 201);
  const published = await publishedResponse.json();
  assert.equal(published.status, "pending_review");
  assert.equal(published.funding.status, "awaiting_moderation");
  assert.equal(published.funding.goalUsdc, "25");
  assert.equal(published.funding.committedUsdc, "0");
  assert.equal(published.funding.verifiedUsdc, "0");
  assert.equal(published.funding.fundsCustodiedByAgentWex, false);

  const hiddenList = await handleExchangeApi(request("/api/exchange/research-bounties", {
    token: solver.apiKey,
  }), db, communityPreviewOptions);
  assert.equal((await hiddenList.json()).bounties.length, 0);

  const moderation = {
    bountyId: published.bountyId,
    decision: "approved",
    reason: "Bounded public research request with explicit safety constraints.",
  };
  const selfModeration = await handleExchangeApi(request(
    "/api/exchange/internal/research-bounties/moderate",
    { method: "POST", token: publisher.apiKey, body: moderation },
  ), db, { ...communityPreviewOptions, adminToken: "trusted-admin" });
  assert.equal(selfModeration.status, 401);
  const moderated = await handleExchangeApi(request(
    "/api/exchange/internal/research-bounties/moderate",
    { method: "POST", token: "trusted-admin", body: moderation },
  ), db, { ...communityPreviewOptions, adminToken: "trusted-admin" });
  assert.equal(moderated.status, 200);
  assert.equal((await moderated.json()).status, "funding_pending");

  const prematureSubmission = await handleExchangeApi(request(
    `/api/exchange/research-bounties/${published.bountyId}/submissions`,
    { method: "POST", token: solver.apiKey, body: {} },
  ), db, communityPreviewOptions);
  assert.equal(prematureSubmission.status, 409);
  assert.deepEqual(await prematureSubmission.json(), { error: "research_bounty_not_open" });

  const firstIntentBody = fundingIntent("10.00", "a");
  const firstIntentResponse = await handleExchangeApi(request(
    `/api/exchange/research-bounties/${published.bountyId}/funding-intents`,
    { method: "POST", token: firstFunder.apiKey, body: firstIntentBody },
  ), db, communityPreviewOptions);
  assert.equal(firstIntentResponse.status, 201);
  const firstIntent = await firstIntentResponse.json();
  assert.equal(firstIntent.status, "awaiting_verification");
  assert.equal(firstIntent.paymentVerified, false);
  assert.equal(firstIntent.fundsCustodiedByAgentWex, false);

  const replayResponse = await handleExchangeApi(request(
    `/api/exchange/research-bounties/${published.bountyId}/funding-intents`,
    { method: "POST", token: firstFunder.apiKey, body: firstIntentBody },
  ), db, communityPreviewOptions);
  assert.equal(replayResponse.status, 200);
  assert.equal((await replayResponse.json()).idempotentReplay, true);

  const verification = {
    fundingIntentId: firstIntent.fundingIntentId,
    settlementReceiptDigest: firstIntent.settlementReceiptDigest,
    verifierReference: "taskmarket:verification:first",
    verifiedAt: "2026-09-05T22:00:00.000Z",
  };
  const selfVerification = await handleExchangeApi(request(
    "/api/exchange/internal/research-bounty-funding/verify",
    { method: "POST", token: firstFunder.apiKey, body: verification },
  ), db, { ...communityPreviewOptions, verifierToken: "trusted-verifier" });
  assert.equal(selfVerification.status, 401);

  const verifiedFirst = await handleExchangeApi(request(
    "/api/exchange/internal/research-bounty-funding/verify",
    { method: "POST", token: "trusted-verifier", body: verification },
  ), db, { ...communityPreviewOptions, verifierToken: "trusted-verifier" });
  assert.equal(verifiedFirst.status, 200);
  assert.equal((await verifiedFirst.json()).paymentVerified, true);

  const halfwayList = await handleExchangeApi(request("/api/exchange/research-bounties", {
    token: publisher.apiKey,
  }), db, communityPreviewOptions);
  const halfway = (await halfwayList.json()).bounties[0];
  assert.equal(halfway.status, "funding_pending");
  assert.equal(halfway.funding.verifiedUsdc, "10");
  assert.equal(halfway.funding.committedUsdc, "10");
  assert.equal(halfway.funding.remainingUsdc, "15");

  const secondIntentBody = fundingIntent("15.00", "b");
  const secondIntentResponse = await handleExchangeApi(request(
    `/api/exchange/research-bounties/${published.bountyId}/funding-intents`,
    { method: "POST", token: secondFunder.apiKey, body: secondIntentBody },
  ), db, communityPreviewOptions);
  const secondIntent = await secondIntentResponse.json();
  const verifiedSecond = await handleExchangeApi(request(
    "/api/exchange/internal/research-bounty-funding/verify",
    { method: "POST", token: "trusted-verifier", body: {
      fundingIntentId: secondIntent.fundingIntentId,
      settlementReceiptDigest: secondIntent.settlementReceiptDigest,
      verifierReference: "taskmarket:verification:second",
      verifiedAt: "2026-09-05T22:01:00.000Z",
    } },
  ), db, { ...communityPreviewOptions, verifierToken: "trusted-verifier" });
  assert.equal(verifiedSecond.status, 200);

  const fundedList = await handleExchangeApi(
    request("/api/exchange/research-bounties"), db, communityPreviewOptions,
  );
  const funded = (await fundedList.json()).bounties[0];
  assert.equal(funded.status, "open");
  assert.equal(funded.funding.status, "funded");
  assert.equal(funded.funding.verifiedUsdc, "25");
  assert.equal(funded.funding.selfAttestedPaymentAccepted, false);
});
