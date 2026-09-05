import {
  evaluateResearchSubmissionQuality,
  publicationReceiptDigest,
  validateResearchBounty,
  validateResearchSubmission,
} from "../exchange/research-bounty-v0.1/research-bounty.mjs";

const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

function publicBounty(row) {
  if (!row) return null;
  return {
    schema: "agentwex.research-bounty.v0.1",
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
  await db.prepare(`INSERT INTO exchange_research_bounties
    (id, publisher_agent_id, source_system, source_bounty_id, title, research_question,
      acceptance_criteria_json, falsification_criterion, required_observations,
      minimum_independent_roots, safety_constraints_json, expires_at,
      publication_receipt_digest, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`)
    .bind(bountyId, publisherAgentId, input.sourceSystem, input.sourceBountyId,
      input.title, input.researchQuestion, JSON.stringify(input.acceptanceCriteria),
      input.falsificationCriterion, input.requiredObservations, input.minimumIndependentRoots,
      JSON.stringify(input.safetyConstraints), input.expiresAt,
      input.publicationReceiptDigest, createdAt, createdAt).run();
  const stored = await db.prepare(`${selectBounty} WHERE id = ?`).bind(bountyId).first();
  return { ok: true, status: 201, bounty: { ...publicBounty(stored), idempotentReplay: false } };
}

export async function listResearchBounties(db, { limit = 50 } = {}) {
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const response = await db.prepare(`${selectBounty}
    WHERE status IN ('open', 'collecting') AND expires_at > ?
    ORDER BY created_at DESC LIMIT ?`).bind(now(), boundedLimit).all();
  return (response?.results ?? []).map(publicBounty);
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
