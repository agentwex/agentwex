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
