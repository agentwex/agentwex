import {
  evaluateResearchSubmissionQuality,
  publicationReceiptDigest,
  usdcMicrounits,
  validateResearchBounty,
  validateResearchFundingIntent,
  validateResearchSubmission,
} from "../exchange/research-bounty-v0.1/research-bounty.mjs";

const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

function exactIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function usdc(microunits) {
  const value = Math.max(0, Number(microunits) || 0);
  const whole = Math.floor(value / 1_000_000);
  const fraction = String(value % 1_000_000).padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function publicBounty(row) {
  if (!row) return null;
  const goal = Number(row.fundingGoalMicrounits ?? 0);
  const verified = Number(row.verifiedFundingMicrounits ?? 0);
  const committed = Number(row.committedFundingMicrounits ?? verified);
  return {
    schema: row.sourceSystem === "agentwex-community"
      ? "agentwex.community-research-bounty.v0.1"
      : "agentwex.research-bounty.v0.1",
    bountyId: row.bountyId,
    sourceSystem: row.sourceSystem,
    sourceBountyId: row.sourceBountyId,
    title: row.title,
    researchQuestion: row.researchQuestion,
    acceptanceCriteria: JSON.parse(row.acceptanceCriteriaJson),
    falsificationCriterion: row.falsificationCriterion,
    requiredObservations: Number(row.requiredObservations),
    minimumIndependentRoots: Number(row.minimumIndependentRoots),
    safetyConstraints: JSON.parse(row.safetyConstraintsJson),
    expiresAt: row.expiresAt,
    publicationReceiptDigest: row.publicationReceiptDigest,
    status: row.status,
    funding: {
      goalUsdc: usdc(goal),
      committedUsdc: usdc(committed),
      verifiedUsdc: usdc(verified),
      remainingUsdc: usdc(Math.max(0, goal - committed)),
      currency: "USDC",
      network: "eip155:8453",
      settlementRail: row.settlementRail,
      status: row.status === "pending_review" ? "awaiting_moderation"
        : goal === 0 ? "not_requested"
        : verified >= goal ? "funded" : "awaiting_verified_settlement",
      fundsCustodiedByAgentWex: false,
      selfAttestedPaymentAccepted: false,
    },
    createdAt: row.createdAt,
    authorityGranted: false,
  };
}

const selectBounty = `SELECT id AS bountyId, publisher_agent_id AS publisherAgentId,
  source_system AS sourceSystem, source_bounty_id AS sourceBountyId, title,
  research_question AS researchQuestion, acceptance_criteria_json AS acceptanceCriteriaJson,
  falsification_criterion AS falsificationCriterion, required_observations AS requiredObservations,
  minimum_independent_roots AS minimumIndependentRoots, safety_constraints_json AS safetyConstraintsJson,
  expires_at AS expiresAt, publication_receipt_digest AS publicationReceiptDigest,
  funding_goal_microunits AS fundingGoalMicrounits, settlement_rail AS settlementRail,
  COALESCE((SELECT SUM(f.amount_microunits) FROM exchange_research_bounty_funding_intents f
    WHERE f.bounty_id = exchange_research_bounties.id AND f.status = 'verified'), 0)
    AS verifiedFundingMicrounits,
  COALESCE((SELECT SUM(f.amount_microunits) FROM exchange_research_bounty_funding_intents f
    WHERE f.bounty_id = exchange_research_bounties.id
      AND f.status IN ('awaiting_verification', 'verified')), 0)
    AS committedFundingMicrounits,
  status, created_at AS createdAt FROM exchange_research_bounties`;

export async function publishResearchBounty(db, publisherAgentId, body) {
  const input = validateResearchBounty(body);
  if (!input) return { ok: false, status: 400, error: "invalid_research_bounty" };
  const expectedDigest = await publicationReceiptDigest(input);
  if (input.publicationReceiptDigest !== expectedDigest) {
    return { ok: false, status: 400, error: "publication_receipt_mismatch" };
  }
  const existing = await db.prepare(`${selectBounty}
    WHERE publisher_agent_id = ? AND source_system = ? AND source_bounty_id = ?`)
    .bind(publisherAgentId, input.sourceSystem, input.sourceBountyId).first();
  if (existing) {
    if (existing.publicationReceiptDigest !== input.publicationReceiptDigest) {
      return { ok: false, status: 409, error: "research_bounty_already_published" };
    }
    return { ok: true, status: 200, bounty: { ...publicBounty(existing), idempotentReplay: true } };
  }
  const bountyId = newId("researchbounty");
  const createdAt = now();
  const community = input.sourceSystem === "agentwex-community";
  const fundingGoalMicrounits = community ? usdcMicrounits(input.fundingGoalUsdc) : 0;
  const status = community ? "pending_review" : "open";
  await db.prepare(`INSERT INTO exchange_research_bounties
    (id, publisher_agent_id, source_system, source_bounty_id, title, research_question,
      acceptance_criteria_json, falsification_criterion, required_observations,
      minimum_independent_roots, safety_constraints_json, expires_at,
      publication_receipt_digest, funding_goal_microunits, settlement_rail,
      status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(bountyId, publisherAgentId, input.sourceSystem, input.sourceBountyId,
      input.title, input.researchQuestion, JSON.stringify(input.acceptanceCriteria),
      input.falsificationCriterion, input.requiredObservations, input.minimumIndependentRoots,
      JSON.stringify(input.safetyConstraints), input.expiresAt,
      input.publicationReceiptDigest, fundingGoalMicrounits,
      community ? input.settlementRail : null, status, createdAt, createdAt).run();
  const stored = await db.prepare(`${selectBounty} WHERE id = ?`).bind(bountyId).first();
  return { ok: true, status: 201, bounty: { ...publicBounty(stored), idempotentReplay: false } };
}

export async function listResearchBounties(db, { limit = 50 } = {}) {
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const response = await db.prepare(`${selectBounty}
    WHERE status IN ('funding_pending', 'open', 'collecting') AND expires_at > ?
    ORDER BY created_at DESC LIMIT ?`).bind(now(), boundedLimit).all();
  return (response?.results ?? []).map(publicBounty);
}

export async function moderateResearchBounty(db, body) {
  const expected = new Set(["bountyId", "decision", "reason"]);
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).length !== expected.size
    || !Object.keys(body).every((key) => expected.has(key))
    || !/^researchbounty_[a-f0-9]{32}$/.test(body.bountyId ?? "")
    || !["approved", "rejected"].includes(body.decision)
    || typeof body.reason !== "string" || body.reason.trim().length < 8
    || body.reason.trim().length > 500) {
    return { ok: false, status: 400, error: "invalid_research_bounty_moderation" };
  }
  const row = await db.prepare(`${selectBounty} WHERE id = ?`).bind(body.bountyId).first();
  if (!row) return { ok: false, status: 404, error: "research_bounty_not_found" };
  if (row.sourceSystem !== "agentwex-community") {
    return { ok: false, status: 409, error: "research_bounty_not_community" };
  }
  const existing = await db.prepare(`SELECT decision, reason, created_at AS createdAt
    FROM exchange_research_bounty_reviews WHERE bounty_id = ?`).bind(body.bountyId).first();
  if (existing) {
    const same = existing.decision === body.decision && existing.reason === body.reason.trim();
    return same
      ? { ok: true, status: 200, moderation: {
        bountyId: body.bountyId, decision: existing.decision,
        status: row.status,
        idempotentReplay: true, authorityGranted: false,
      } }
      : { ok: false, status: 409, error: "research_bounty_already_moderated" };
  }
  if (row.status !== "pending_review") {
    return { ok: false, status: 409, error: "research_bounty_not_pending_review" };
  }
  const createdAt = now();
  const nextStatus = body.decision === "approved" ? "funding_pending" : "closed";
  await db.batch([
    db.prepare(`INSERT INTO exchange_research_bounty_reviews
      (id, bounty_id, decision, reason, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(newId("researchreview"), body.bountyId, body.decision, body.reason.trim(), createdAt),
    db.prepare(`UPDATE exchange_research_bounties SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(nextStatus, createdAt, body.bountyId),
  ]);
  return { ok: true, status: 200, moderation: {
    bountyId: body.bountyId,
    decision: body.decision,
    status: nextStatus,
    idempotentReplay: false,
    authorityGranted: false,
  } };
}

function publicFundingIntent(row, idempotentReplay = false) {
  return {
    schema: "agentwex.research-bounty-funding-intent.v0.1",
    fundingIntentId: row.fundingIntentId,
    bountyId: row.bountyId,
    amountUsdc: usdc(row.amountMicrounits),
    currency: "USDC",
    network: "eip155:8453",
    settlementRail: row.settlementRail,
    externalSettlementId: row.externalSettlementId,
    settlementReceiptDigest: row.settlementReceiptDigest,
    status: row.status,
    createdAt: row.createdAt,
    verifiedAt: row.verifiedAt ?? null,
    idempotentReplay,
    fundsCustodiedByAgentWex: false,
    paymentVerified: row.status === "verified",
    authorityGranted: false,
  };
}

const selectFundingIntent = `SELECT id AS fundingIntentId, bounty_id AS bountyId,
  funder_agent_id AS funderAgentId, amount_microunits AS amountMicrounits,
  settlement_rail AS settlementRail, idempotency_key AS idempotencyKey,
  external_settlement_id AS externalSettlementId,
  settlement_receipt_digest AS settlementReceiptDigest, status,
  created_at AS createdAt, verified_at AS verifiedAt
  FROM exchange_research_bounty_funding_intents`;

export async function createResearchBountyFundingIntent(db, funderAgentId, bountyId, body) {
  if (!/^researchbounty_[a-f0-9]{32}$/.test(bountyId ?? "")) {
    return { ok: false, status: 400, error: "invalid_research_bounty_id" };
  }
  const row = await db.prepare(`${selectBounty} WHERE id = ?`).bind(bountyId).first();
  if (!row) return { ok: false, status: 404, error: "research_bounty_not_found" };
  const bounty = publicBounty(row);
  if (row.status === "pending_review") {
    return { ok: false, status: 409, error: "research_bounty_pending_moderation" };
  }
  if (Number(row.fundingGoalMicrounits ?? 0) <= 0 || !row.settlementRail) {
    return { ok: false, status: 409, error: "research_bounty_not_seeking_funding" };
  }
  if (bounty.funding.status === "funded") {
    return { ok: false, status: 409, error: "research_bounty_fully_funded" };
  }
  const input = validateResearchFundingIntent(body, row.settlementRail);
  if (!input) return { ok: false, status: 400, error: "invalid_research_bounty_funding_intent" };
  const existing = await db.prepare(`${selectFundingIntent}
    WHERE funder_agent_id = ? AND bounty_id = ? AND idempotency_key = ?`)
    .bind(funderAgentId, bountyId, input.idempotencyKey).first();
  if (existing) {
    const same = Number(existing.amountMicrounits) === input.amountMicrounits
      && existing.settlementRail === input.settlementRail
      && existing.externalSettlementId === input.externalSettlementId
      && existing.settlementReceiptDigest === input.settlementReceiptDigest;
    return same
      ? { ok: true, status: 200, intent: publicFundingIntent(existing, true) }
      : { ok: false, status: 409, error: "funding_intent_idempotency_conflict" };
  }
  const remaining = Number(row.fundingGoalMicrounits) - Number(row.committedFundingMicrounits ?? 0);
  if (input.amountMicrounits > remaining) {
    return { ok: false, status: 409, error: "funding_amount_exceeds_remaining" };
  }
  const fundingIntentId = newId("researchfunding");
  const createdAt = now();
  try {
    await db.prepare(`INSERT INTO exchange_research_bounty_funding_intents
      (id, bounty_id, funder_agent_id, amount_microunits, currency, network,
        settlement_rail, idempotency_key, external_settlement_id,
        settlement_receipt_digest, status, created_at)
      VALUES (?, ?, ?, ?, 'USDC', 'eip155:8453', ?, ?, ?, ?, 'awaiting_verification', ?)`)
      .bind(fundingIntentId, bountyId, funderAgentId, input.amountMicrounits,
        input.settlementRail, input.idempotencyKey, input.externalSettlementId,
        input.settlementReceiptDigest, createdAt).run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return { ok: false, status: 409, error: "settlement_already_claimed" };
    }
    throw error;
  }
  const stored = await db.prepare(`${selectFundingIntent} WHERE id = ?`)
    .bind(fundingIntentId).first();
  return { ok: true, status: 201, intent: publicFundingIntent(stored) };
}

export async function verifyResearchBountyFunding(db, body) {
  const expected = new Set([
    "fundingIntentId", "settlementReceiptDigest", "verifierReference", "verifiedAt",
  ]);
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).length !== expected.size
    || !Object.keys(body).every((key) => expected.has(key))
    || !/^researchfunding_[a-f0-9]{32}$/.test(body.fundingIntentId ?? "")
    || !/^sha256:[a-f0-9]{64}$/.test(body.settlementReceiptDigest ?? "")
    || typeof body.verifierReference !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(body.verifierReference)
    || !exactIsoTimestamp(body.verifiedAt)) {
    return { ok: false, status: 400, error: "invalid_funding_verification" };
  }
  const intent = await db.prepare(`${selectFundingIntent} WHERE id = ?`)
    .bind(body.fundingIntentId).first();
  if (!intent) return { ok: false, status: 404, error: "funding_intent_not_found" };
  if (intent.settlementReceiptDigest !== body.settlementReceiptDigest) {
    return { ok: false, status: 409, error: "settlement_receipt_mismatch" };
  }
  if (intent.status === "verified") {
    return { ok: true, status: 200, verification: publicFundingIntent(intent, true) };
  }
  if (intent.status !== "awaiting_verification") {
    return { ok: false, status: 409, error: "funding_intent_not_verifiable" };
  }
  await db.prepare(`UPDATE exchange_research_bounty_funding_intents
    SET status = 'verified', verified_at = ?, verifier_reference = ? WHERE id = ?`)
    .bind(body.verifiedAt, body.verifierReference, body.fundingIntentId).run();
  const aggregate = await db.prepare(`SELECT COALESCE(SUM(amount_microunits), 0) AS verified
    FROM exchange_research_bounty_funding_intents
    WHERE bounty_id = ? AND status = 'verified'`).bind(intent.bountyId).first();
  const bounty = await db.prepare(`SELECT funding_goal_microunits AS goal
    FROM exchange_research_bounties WHERE id = ?`).bind(intent.bountyId).first();
  if (Number(aggregate?.verified ?? 0) >= Number(bounty?.goal ?? Number.MAX_SAFE_INTEGER)) {
    await db.prepare(`UPDATE exchange_research_bounties SET status = 'open', updated_at = ?
      WHERE id = ? AND status = 'funding_pending'`).bind(body.verifiedAt, intent.bountyId).run();
  }
  const stored = await db.prepare(`${selectFundingIntent} WHERE id = ?`)
    .bind(body.fundingIntentId).first();
  return { ok: true, status: 200, verification: publicFundingIntent(stored) };
}

export async function submitResearchBountyResult(db, agentId, bountyId, body) {
  if (!/^researchbounty_[a-f0-9]{32}$/.test(bountyId ?? "")) {
    return { ok: false, status: 400, error: "invalid_research_bounty_id" };
  }
  const row = await db.prepare(`${selectBounty} WHERE id = ?`).bind(bountyId).first();
  if (!row) return { ok: false, status: 404, error: "research_bounty_not_found" };
  if (!["open", "collecting"].includes(row.status) || Date.parse(row.expiresAt) <= Date.now()) {
    return { ok: false, status: 409, error: "research_bounty_not_open" };
  }
  const bounty = publicBounty(row);
  const input = validateResearchSubmission(body, bounty.acceptanceCriteria.length);
  if (!input) return { ok: false, status: 400, error: "invalid_research_bounty_submission" };
  const existing = await db.prepare(`SELECT id AS submissionId, quality_json AS qualityJson,
      submitted_at AS submittedAt FROM exchange_research_bounty_submissions
    WHERE bounty_id = ? AND agent_id = ? AND artifact_digest = ?`)
    .bind(bountyId, agentId, input.artifactDigest).first();
  if (existing) {
    return { ok: true, status: 200, submission: {
      submissionId: existing.submissionId,
      bountyId,
      quality: JSON.parse(existing.qualityJson),
      submittedAt: existing.submittedAt,
      status: "candidate",
      idempotentReplay: true,
    } };
  }
  const quality = evaluateResearchSubmissionQuality(bounty, input);
  const submissionId = newId("researchsubmission");
  const submittedAt = now();
  await db.batch([
    db.prepare(`INSERT INTO exchange_research_bounty_submissions
      (id, bounty_id, agent_id, public_artifact_url, artifact_digest, method_summary,
        observation_count, criterion_evidence_json, provenance_roots_json,
        reproducibility_receipt_digest, quality_json, structural_score, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?)`)
      .bind(submissionId, bountyId, agentId, input.publicArtifactUrl, input.artifactDigest,
        input.methodSummary, input.observationCount, JSON.stringify(input.criterionEvidence),
        JSON.stringify(input.provenanceRoots), input.reproducibilityReceiptDigest,
        JSON.stringify(quality), quality.structuralScore, submittedAt),
    db.prepare(`UPDATE exchange_research_bounties SET status = 'collecting', updated_at = ?
      WHERE id = ? AND status = 'open'`).bind(submittedAt, bountyId),
  ]);
  return { ok: true, status: 201, submission: {
    submissionId,
    bountyId,
    quality,
    submittedAt,
    status: "candidate",
    idempotentReplay: false,
  } };
}

export async function getResearchBountyQuality(db, publisherAgentId, bountyId) {
  const row = await db.prepare(`${selectBounty} WHERE id = ?`).bind(bountyId).first();
  if (!row || row.publisherAgentId !== publisherAgentId) return null;
  const response = await db.prepare(`SELECT id AS submissionId,
      public_artifact_url AS publicArtifactUrl, artifact_digest AS artifactDigest,
      method_summary AS methodSummary, observation_count AS observationCount,
      quality_json AS qualityJson, structural_score AS structuralScore,
      status, submitted_at AS submittedAt
    FROM exchange_research_bounty_submissions WHERE bounty_id = ?
    ORDER BY structural_score DESC, submitted_at ASC`).bind(bountyId).all();
  const submissions = (response?.results ?? []).map((item) => ({
    submissionId: item.submissionId,
    publicArtifactUrl: item.publicArtifactUrl,
    artifactDigest: item.artifactDigest,
    methodSummary: item.methodSummary,
    observationCount: Number(item.observationCount),
    quality: JSON.parse(item.qualityJson),
    status: item.status,
    submittedAt: item.submittedAt,
  }));
  const scores = submissions.map((item) => Number(item.structuralScore ?? item.quality.structuralScore));
  return {
    schema: "agentwex.research-bounty-quality-monitor.v0.1",
    bountyId,
    sourceBountyId: row.sourceBountyId,
    status: row.status,
    submissionCount: submissions.length,
    readyForHumanReviewCount: submissions.filter((item) => item.quality.readyForHumanReview).length,
    averageStructuralScore: scores.length
      ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : null,
    highestStructuralScore: scores.length ? Math.max(...scores) : null,
    submissions,
    scientificValidityEstablished: false,
    authorityGranted: false,
  };
}
