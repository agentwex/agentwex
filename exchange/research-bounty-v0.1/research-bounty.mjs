import { canonicalJson } from "../knowledge-exchange-v0.1/receipt-attestation.mjs";

export const RESEARCH_BOUNTY_SCHEMA = "agentwex.research-bounty.v0.1";
export const RESEARCH_SUBMISSION_SCHEMA = "agentwex.research-bounty-submission.v0.1";
export const RESEARCH_QUALITY_SCHEMA = "agentwex.research-bounty-quality.v0.1";

const bountyFields = new Set([
  "schema", "sourceSystem", "sourceBountyId", "title", "researchQuestion",
  "acceptanceCriteria", "falsificationCriterion", "requiredObservations",
  "minimumIndependentRoots", "safetyConstraints", "expiresAt",
  "publicationReceiptDigest",
]);
const submissionFields = new Set([
  "schema", "publicArtifactUrl", "artifactDigest", "methodSummary",
  "observationCount", "criterionEvidence", "provenanceRoots",
  "reproducibilityReceiptDigest",
]);
const forbiddenPublicText = [
  /(?:https?|file):\/\//i,
  /(?:^|\s)\/(?:Users|home|private|var|etc)\//i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:api[_ -]?key|password|secret|bearer)\s*[:=]/i,
  /\b(?:sk|wex)_[A-Za-z0-9_-]{20,}\b/,
  /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b/i,
];

const exactKeys = (value, expected) => value && typeof value === "object"
  && !Array.isArray(value)
  && Object.keys(value).length === expected.size
  && Object.keys(value).every((key) => expected.has(key));

function boundedPublicText(value, maximum) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || new TextEncoder().encode(normalized).length > maximum) return null;
  return forbiddenPublicText.some((pattern) => pattern.test(normalized)) ? null : normalized;
}

function boundedPublicTextList(value, { minimum = 1, maximum = 12, itemBytes = 1_000 } = {}) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
  const normalized = value.map((item) => boundedPublicText(item, itemBytes));
  return normalized.every(Boolean) && new Set(normalized).size === normalized.length ? normalized : null;
}

function isoTimestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString() === value ? value : null;
}

function publicHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (/^(?:127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function validateResearchBounty(value) {
  if (!exactKeys(value, bountyFields) || value.schema !== RESEARCH_BOUNTY_SCHEMA) return null;
  if (value.sourceSystem !== "invention-graph") return null;
  if (!/^igb_[a-f0-9]{32}$/.test(value.sourceBountyId ?? "")) return null;
  const title = boundedPublicText(value.title, 200);
  const researchQuestion = boundedPublicText(value.researchQuestion, 2_000);
  const acceptanceCriteria = boundedPublicTextList(value.acceptanceCriteria);
  const falsificationCriterion = boundedPublicText(value.falsificationCriterion, 2_000);
  const safetyConstraints = boundedPublicTextList(value.safetyConstraints, { maximum: 20 });
  const expiresAt = isoTimestamp(value.expiresAt);
  const publicationReceiptDigest = typeof value.publicationReceiptDigest === "string"
    && /^sha256:[a-f0-9]{64}$/.test(value.publicationReceiptDigest)
    ? value.publicationReceiptDigest : null;
  if (!title || !researchQuestion || !acceptanceCriteria || !falsificationCriterion
    || !safetyConstraints || !expiresAt || !publicationReceiptDigest) return null;
  if (!Number.isInteger(value.requiredObservations) || value.requiredObservations < 1
    || value.requiredObservations > 1_000_000) return null;
  if (!Number.isInteger(value.minimumIndependentRoots) || value.minimumIndependentRoots < 1
    || value.minimumIndependentRoots > 100) return null;
  return {
    schema: RESEARCH_BOUNTY_SCHEMA,
    sourceSystem: "invention-graph",
    sourceBountyId: value.sourceBountyId,
    title,
    researchQuestion,
    acceptanceCriteria,
    falsificationCriterion,
    requiredObservations: value.requiredObservations,
    minimumIndependentRoots: value.minimumIndependentRoots,
    safetyConstraints,
    expiresAt,
    publicationReceiptDigest,
  };
}

export function validateResearchSubmission(value, acceptanceCriterionCount = 0) {
  if (!exactKeys(value, submissionFields) || value.schema !== RESEARCH_SUBMISSION_SCHEMA) return null;
  const publicArtifactUrl = publicHttpsUrl(value.publicArtifactUrl);
  const artifactDigest = typeof value.artifactDigest === "string" && /^sha256:[a-f0-9]{64}$/.test(value.artifactDigest)
    ? value.artifactDigest : null;
  const methodSummary = boundedPublicText(value.methodSummary, 2_000);
  const reproducibilityReceiptDigest = value.reproducibilityReceiptDigest === null
    ? null
    : typeof value.reproducibilityReceiptDigest === "string"
      && /^sha256:[a-f0-9]{64}$/.test(value.reproducibilityReceiptDigest)
      ? value.reproducibilityReceiptDigest : null;
  if (!publicArtifactUrl || !artifactDigest || !methodSummary) return null;
  if (value.reproducibilityReceiptDigest !== null && !reproducibilityReceiptDigest) return null;
  if (!Number.isInteger(value.observationCount) || value.observationCount < 0
    || value.observationCount > 10_000_000) return null;
  if (!Array.isArray(value.criterionEvidence) || value.criterionEvidence.length > acceptanceCriterionCount
    || !value.criterionEvidence.every((index) => Number.isInteger(index) && index >= 0 && index < acceptanceCriterionCount)
    || new Set(value.criterionEvidence).size !== value.criterionEvidence.length) return null;
  if (!Array.isArray(value.provenanceRoots) || value.provenanceRoots.length > 100
    || !value.provenanceRoots.every((root) => typeof root === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/.test(root))
    || new Set(value.provenanceRoots).size !== value.provenanceRoots.length) return null;
  return {
    schema: RESEARCH_SUBMISSION_SCHEMA,
    publicArtifactUrl,
    artifactDigest,
    methodSummary,
    observationCount: value.observationCount,
    criterionEvidence: [...value.criterionEvidence].sort((a, b) => a - b),
    provenanceRoots: [...value.provenanceRoots].sort(),
    reproducibilityReceiptDigest,
  };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function publicationReceiptDigest(bounty) {
  const publicEnvelope = { ...bounty };
  delete publicEnvelope.publicationReceiptDigest;
  return `sha256:${await sha256(canonicalJson(publicEnvelope))}`;
}

export function evaluateResearchSubmissionQuality(bounty, submission) {
  const criterionCoverage = bounty.acceptanceCriteria.length === 0
    ? 0 : submission.criterionEvidence.length / bounty.acceptanceCriteria.length;
  const observationCoverage = Math.min(1, submission.observationCount / bounty.requiredObservations);
  const provenanceCoverage = Math.min(1, submission.provenanceRoots.length / bounty.minimumIndependentRoots);
  const replayBound = submission.reproducibilityReceiptDigest !== null;
  const score = Math.round(
    (criterionCoverage * 30)
    + (observationCoverage * 25)
    + (provenanceCoverage * 25)
    + (replayBound ? 20 : 0),
  );
  return {
    schema: RESEARCH_QUALITY_SCHEMA,
    structuralScore: score,
    criterionCoverage: Number(criterionCoverage.toFixed(4)),
    observationCoverage: Number(observationCoverage.toFixed(4)),
    provenanceCoverage: Number(provenanceCoverage.toFixed(4)),
    distinctProvenanceRoots: submission.provenanceRoots.length,
    provenanceIndependenceVerified: false,
    replayReceiptPresent: replayBound,
    readyForHumanReview: score >= 80 && criterionCoverage === 1,
    scientificValidityEstablished: false,
    authorityGranted: false,
  };
}
