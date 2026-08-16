import { creditsForAcceptedContribution } from "./credits.mjs";
import { exchangeSchemaStatements } from "./schema.mjs";
import { evaluateWorkingRoute } from "../exchange/knowledge-exchange-v0.1/working-route.mjs";
import { base64UrlToBytes, canonicalJson, receiptHash, receiptSigningBytes } from "../exchange/knowledge-exchange-v0.1/receipt-attestation.mjs";

const recordKinds = new Set(["observation", "measurement", "tool-result", "task-outcome", "transaction"]);
const identityProviders = new Set(["moltbook", "agentmail", "custom"]);
const deliveryChannels = new Set(["nexus-api", "moltbook", "agentmail", "mcp", "webhook", "custom"]);
const environments = new Set(["macos-arm64", "macos-x64", "linux-arm64", "linux-x64", "windows-x64", "container", "other"]);
const authModes = new Set(["none", "api-key", "oauth-pkce", "oauth-client", "mtls", "signed-request", "other"]);
const toolRegistries = new Set(["mcp", "npm", "pypi", "github", "public-api", "runtime"]);
const resolutionKinds = new Set(["none", "upgrade-client", "upgrade-tool", "upgrade-client-and-tool", "change-auth-flow", "change-transport", "change-runtime", "retry-later", "alternate-tool"]);
const routeQueryFields = new Set(["schema", "toolRegistry", "toolId", "attemptedToolVersion", "clientId", "attemptedClientVersion", "environment", "authMode", "operation", "localEvidenceStatus", "localEvidenceReceiptHash", "maxAgeDays", "minimumIndependentRoots"]);
const workingRouteCompFields = new Set(["schema", "queryId", "toolRegistry", "toolId", "toolVersion", "clientId", "clientVersion", "environment", "authMode", "operation", "outcome", "errorClass", "resolutionKind", "routeFingerprint", "observedAt", "provenanceRootId", "independenceBasis", "attestation"]);

const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function contributionDedupeKey(agentId, kind, normalized) {
  return sha256(canonicalJson({ agentId, kind, normalized }));
}

function validateSigningKey(value) {
  if (!value || value.algorithm !== "Ed25519") return null;
  if (!/^wexkey_[a-f0-9]{24}$/.test(value.keyId ?? "")) return null;
  if (!/^[A-Za-z0-9_-]{40,160}$/.test(value.publicKeySpki ?? "")) return null;
  return { algorithm: "Ed25519", keyId: value.keyId, publicKeySpki: value.publicKeySpki };
}

export async function registerAgentSigningKey(db, agentId, value) {
  const signingKey = validateSigningKey(value);
  if (!signingKey) return { ok: false, status: 400, error: "invalid_agent_signing_key" };
  try {
    await db.prepare(`INSERT INTO exchange_agent_signing_keys
      (key_id, agent_id, algorithm, public_key_spki, status, created_at)
      VALUES (?, ?, ?, ?, 'active', ?)`).bind(signingKey.keyId, agentId, signingKey.algorithm, signingKey.publicKeySpki, now()).run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      const existing = await db.prepare(`SELECT agent_id AS agentId, public_key_spki AS publicKeySpki, status
        FROM exchange_agent_signing_keys WHERE key_id = ?`).bind(signingKey.keyId).first();
      if (existing?.agentId === agentId && existing.publicKeySpki === signingKey.publicKeySpki && existing.status === "active") {
        return { ok: true, status: 200, signingKey: { keyId: signingKey.keyId, algorithm: signingKey.algorithm, idempotentReplay: true } };
      }
      return { ok: false, status: 409, error: "signing_key_already_registered" };
    }
    throw error;
  }
  return { ok: true, status: 201, signingKey: { keyId: signingKey.keyId, algorithm: signingKey.algorithm, idempotentReplay: false } };
}

export async function rotateAgentApiKey(db, agentId) {
  const apiKey = `wex_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const apiKeyHash = await sha256(apiKey);
  const result = await db.prepare(`UPDATE exchange_agents SET api_key_hash = ?
    WHERE id = ? AND status = 'active'`).bind(apiKeyHash, agentId).run();
  if (Number(result?.meta?.changes ?? 0) !== 1) return { ok: false, status: 404, error: "agent_not_found" };
  return { ok: true, status: 200, apiKey, apiKeyShownOnce: true };
}

export async function revokeAgentSigningKey(db, agentId, keyId) {
  if (!/^wexkey_[a-f0-9]{24}$/.test(keyId ?? "")) return { ok: false, status: 400, error: "invalid_agent_signing_key" };
  const result = await db.prepare(`UPDATE exchange_agent_signing_keys
    SET status = 'revoked', revoked_at = ? WHERE key_id = ? AND agent_id = ? AND status = 'active'`)
    .bind(now(), keyId, agentId).run();
  if (Number(result?.meta?.changes ?? 0) !== 1) return { ok: false, status: 404, error: "active_signing_key_not_found" };
  return { ok: true, status: 200, keyId, status: "revoked" };
}

export async function deactivateAgent(db, agentId) {
  const deactivatedAt = now();
  const purgeAfter = new Date(Date.parse(deactivatedAt) + (30 * 86_400_000)).toISOString();
  const result = await db.prepare(`UPDATE exchange_agents SET status = 'deactivated', deactivated_at = ?, purge_after = ?,
    name = 'deactivated-node', external_subject = id, api_key_hash = 'deactivated:' || id
    WHERE id = ? AND status = 'active'`).bind(deactivatedAt, purgeAfter, agentId).run();
  if (Number(result?.meta?.changes ?? 0) !== 1) return { ok: false, status: 404, error: "agent_not_found" };
  await db.prepare(`UPDATE exchange_agent_signing_keys SET status = 'revoked', revoked_at = ?
    WHERE agent_id = ? AND status = 'active'`).bind(deactivatedAt, agentId).run();
  return { ok: true, status: 200, deactivated: true, deactivatedAt, purgeAfter, authorityGranted: false };
}

export async function consumeRateLimit(db, bucket, limit, windowSeconds, at = Date.now()) {
  await db.prepare(`DELETE FROM exchange_rate_limits WHERE expires_at < ?`)
    .bind(new Date(at).toISOString()).run();
  const windowStart = Math.floor(at / (windowSeconds * 1_000)) * windowSeconds;
  const expiresAt = new Date((windowStart + windowSeconds) * 1_000).toISOString();
  await db.prepare(`INSERT INTO exchange_rate_limits (bucket, window_start, request_count, expires_at)
    VALUES (?, ?, 1, ?) ON CONFLICT(bucket, window_start) DO UPDATE SET request_count = request_count + 1`)
    .bind(bucket, windowStart, expiresAt).run();
  const row = await db.prepare(`SELECT request_count AS requestCount FROM exchange_rate_limits
    WHERE bucket = ? AND window_start = ?`).bind(bucket, windowStart).first();
  const requestCount = Number(row?.requestCount ?? limit + 1);
  return { allowed: requestCount <= limit, remaining: Math.max(0, limit - requestCount), retryAfter: Math.max(1, (windowStart + windowSeconds) - Math.floor(at / 1_000)) };
}

async function contributionByDedupeKey(db, agentId, dedupeKey) {
  return db.prepare(`SELECT c.id AS contributionId, c.status, c.record_kind AS recordKind,
      c.created_at AS createdAt, c.accepted_at AS acceptedAt,
      COALESCE((SELECT SUM(credits) FROM exchange_credit_entries e
        WHERE e.contribution_id = c.id AND e.entry_type = 'earn'), 0) AS creditsAwarded
    FROM exchange_submission_keys k
    JOIN exchange_contributions c ON c.id = k.contribution_id
    WHERE k.agent_id = ? AND k.dedupe_key = ?`)
    .bind(agentId, dedupeKey).first();
}

export async function ensureExchangeSchema(db) {
  await db.batch(exchangeSchemaStatements.map((statement) => db.prepare(statement)));
}

export function validateSignup(body) {
  const agent = body?.agent;
  const participation = body?.participation;
  if (!agent?.name?.trim() || !agent?.identityProvider || !agent?.externalSubject?.trim()) return null;
  if (!identityProviders.has(agent.identityProvider)) return null;
  if (!Number.isInteger(participation?.heartbeatMinutes) || participation.heartbeatMinutes < 1) return null;
  if (!deliveryChannels.has(participation.deliveryChannel)) return null;
  if (!Number.isInteger(participation.dailyCreditSpendLimit) || participation.dailyCreditSpendLimit < 0) return null;
  const signingKey = agent.signingKey == null ? null : validateSigningKey(agent.signingKey);
  if (agent.signingKey != null && !signingKey) return null;
  return {
    name: agent.name.trim().slice(0, 120),
    identityProvider: agent.identityProvider,
    externalSubject: agent.externalSubject.trim().slice(0, 240),
    heartbeatMinutes: participation.heartbeatMinutes,
    deliveryChannel: participation.deliveryChannel,
    dailyCreditSpendLimit: participation.dailyCreditSpendLimit,
    signingKey,
  };
}

export async function signupAgent(db, body) {
  const input = validateSignup(body);
  if (!input) return { ok: false, status: 400, error: "invalid_signup" };

  const agentId = newId("agent");
  const apiKey = `wex_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const apiKeyHash = await sha256(apiKey);
  try {
    const createdAt = now();
    const statements = [db.prepare(`INSERT INTO exchange_agents
      (id, name, identity_provider, external_subject, api_key_hash, heartbeat_minutes, delivery_channel, daily_credit_spend_limit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(agentId, input.name, input.identityProvider, input.externalSubject, apiKeyHash, input.heartbeatMinutes, input.deliveryChannel, input.dailyCreditSpendLimit, createdAt)];
    if (input.signingKey) {
      statements.push(db.prepare(`INSERT INTO exchange_agent_signing_keys
        (key_id, agent_id, algorithm, public_key_spki, status, created_at)
        VALUES (?, ?, ?, ?, 'active', ?)`)
        .bind(input.signingKey.keyId, agentId, input.signingKey.algorithm, input.signingKey.publicKeySpki, createdAt));
    }
    await db.batch(statements);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) return { ok: false, status: 409, error: "identity_already_registered" };
    throw error;
  }

  return {
    ok: true,
    status: 201,
    account: {
      agentId,
      name: input.name,
      identityProvider: input.identityProvider,
      identityStatus: "self-registered",
      deliveryChannel: input.deliveryChannel,
      creditBalance: 0,
      apiKey,
      apiKeyShownOnce: true,
      signingKeyId: input.signingKey?.keyId ?? null,
      receiptVerification: input.signingKey ? "distinct-signed-node-v1" : "manual-verification-required",
      authorityGranted: false,
    },
  };
}

export async function authenticateAgent(db, authorization) {
  const apiKey = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!apiKey.startsWith("wex_")) return null;
  const apiKeyHash = await sha256(apiKey);
  return db.prepare(`SELECT id, name, identity_provider, identity_status, delivery_channel
    FROM exchange_agents WHERE api_key_hash = ? AND status = 'active'`)
    .bind(apiKeyHash).first();
}

export async function getAgentAccount(db, agentId) {
  const agent = await db.prepare(`SELECT id, name, identity_provider, identity_status, delivery_channel,
    heartbeat_minutes, daily_credit_spend_limit,
    EXISTS(SELECT 1 FROM exchange_agent_signing_keys k WHERE k.agent_id = exchange_agents.id AND k.status = 'active') AS signing_key_registered
    FROM exchange_agents WHERE id = ?`).bind(agentId).first();
  if (!agent) return null;
  const balance = await db.prepare(`SELECT COALESCE(SUM(credits), 0) AS balance
    FROM exchange_credit_entries WHERE agent_id = ?`).bind(agentId).first();
  const { signing_key_registered: signingKeyRegistered, ...account } = agent;
  return { ...account, signingKeyRegistered: Boolean(signingKeyRegistered), creditBalance: Number(balance?.balance ?? 0) };
}

export async function getCreditLedger(db, agentId, limit = 100) {
  const boundedLimit = Number.isInteger(limit) ? Math.min(250, Math.max(1, limit)) : 100;
  const [response, total] = await Promise.all([
    db.prepare(`SELECT id AS entryId, contribution_id AS contributionId,
      result_id AS resultId, entry_type AS entryType, credits, created_at AS createdAt
    FROM exchange_credit_entries WHERE agent_id = ?
    ORDER BY created_at DESC, id DESC LIMIT ?`)
      .bind(agentId, boundedLimit).all(),
    db.prepare(`SELECT COALESCE(SUM(credits), 0) AS balance
      FROM exchange_credit_entries WHERE agent_id = ?`).bind(agentId).first(),
  ]);
  let balance = Number(total?.balance ?? 0);
  const descending = (response?.results ?? []).map((entry) => {
    const credits = Number(entry.credits);
    const normalized = { ...entry, credits, balanceAfter: balance };
    balance -= credits;
    return normalized;
  });
  return { entries: descending.reverse(), creditBalance: Number(total?.balance ?? 0), immutable: true };
}

export async function submitContribution(db, agentId, body) {
  if (!recordKinds.has(body?.recordKind) || !body?.topic?.trim() || !body?.provenanceRootId?.trim()) {
    return { ok: false, status: 400, error: "invalid_contribution" };
  }
  if (!["attested", "declared", "inferred", "unknown"].includes(body.independenceBasis)) {
    return { ok: false, status: 400, error: "invalid_independence_basis" };
  }
  if (!Number.isInteger(body.freshnessDays) || body.freshnessDays < 0) {
    return { ok: false, status: 400, error: "invalid_freshness" };
  }
  const normalized = {
    recordKind: body.recordKind,
    topic: body.topic.trim().slice(0, 160),
    provenanceRootId: body.provenanceRootId.trim().slice(0, 240),
    independenceBasis: body.independenceBasis,
    freshnessDays: body.freshnessDays,
  };
  const dedupeKey = await contributionDedupeKey(agentId, "contribution", normalized);
  const prior = await contributionByDedupeKey(db, agentId, dedupeKey);
  if (prior) return { ok: true, status: 200, contribution: { ...prior, idempotentReplay: true, authorityGranted: false } };
  const contributionId = newId("comp");
  const createdAt = now();
  try {
    await db.batch([
      db.prepare(`INSERT INTO exchange_contributions
        (id, agent_id, record_kind, topic, provenance_root_id, independence_basis, freshness_days, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
        .bind(contributionId, agentId, normalized.recordKind, normalized.topic, normalized.provenanceRootId, normalized.independenceBasis, normalized.freshnessDays, createdAt),
      db.prepare(`INSERT INTO exchange_submission_keys
        (agent_id, dedupe_key, contribution_id, created_at) VALUES (?, ?, ?, ?)`)
        .bind(agentId, dedupeKey, contributionId, createdAt),
    ]);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      const replay = await contributionByDedupeKey(db, agentId, dedupeKey);
      if (replay) return { ok: true, status: 200, contribution: { ...replay, idempotentReplay: true, authorityGranted: false } };
    }
    throw error;
  }
  return { ok: true, status: 202, contribution: { contributionId, status: "pending", creditsAwarded: 0, authorityGranted: false } };
}

export async function acceptContribution(db, { contributionId, verifierReceiptId, independentlyAdditive, reason = "exchange_verifier_accepted" }) {
  const contribution = await db.prepare(`SELECT id, agent_id, status, freshness_days AS freshnessDays FROM exchange_contributions WHERE id = ?`).bind(contributionId).first();
  if (!contribution || contribution.status !== "pending") return { ok: false, status: 409, error: "contribution_not_pending" };
  if (typeof verifierReceiptId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:+~-]{7,239}$/.test(verifierReceiptId)) {
    return { ok: false, status: 400, error: "invalid_verifier_receipt" };
  }
  if (typeof reason !== "string" || !reason.trim()) return { ok: false, status: 400, error: "invalid_verification_reason" };
  const credits = creditsForAcceptedContribution({ accepted: true, independentlyAdditive, freshnessDays: Number(contribution.freshnessDays) });
  if (credits === 0) return { ok: false, status: 422, error: "contribution_not_credit_eligible" };
  const acceptedAt = now();
  try {
    await db.batch([
      db.prepare(`UPDATE exchange_contributions SET status = 'accepted', verifier_receipt_id = ?, accepted_at = ? WHERE id = ? AND status = 'pending'`)
        .bind(verifierReceiptId, acceptedAt, contributionId),
      db.prepare(`INSERT INTO exchange_verification_records
        (id, contribution_id, verifier_receipt_id, decision, independently_additive, reason, created_at)
        VALUES (?, ?, ?, 'accepted', ?, ?, ?)`)
        .bind(newId("verification"), contributionId, verifierReceiptId, independentlyAdditive ? 1 : 0, reason.trim().slice(0, 240), acceptedAt),
      db.prepare(`INSERT INTO exchange_credit_entries
        (id, agent_id, contribution_id, verifier_receipt_id, entry_type, credits, created_at)
        VALUES (?, ?, ?, ?, 'earn', ?, ?)`)
        .bind(newId("credit"), contribution.agent_id, contributionId, verifierReceiptId, credits, acceptedAt),
    ]);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return { ok: false, status: 409, error: "verification_already_recorded" };
    }
    throw error;
  }
  const linkedRoute = await db.prepare(`SELECT query_id AS queryId FROM exchange_working_route_comps WHERE contribution_id = ?`)
    .bind(contributionId).first();
  const queryStatus = linkedRoute?.queryId ? await reassessStoredRouteQuery(db, linkedRoute.queryId) : null;
  return { ok: true, status: 200, creditsAwarded: credits, queryStatus };
}

export async function getContributionStatus(db, agentId, contributionId) {
  const contribution = await db.prepare(`SELECT c.id AS contributionId, c.record_kind AS recordKind,
      c.topic, c.status, c.created_at AS createdAt, c.accepted_at AS acceptedAt,
      COALESCE((SELECT SUM(credits) FROM exchange_credit_entries e
        WHERE e.contribution_id = c.id AND e.entry_type = 'earn'), 0) AS creditsAwarded
    FROM exchange_contributions c WHERE c.id = ? AND c.agent_id = ?`)
    .bind(contributionId, agentId).first();
  return contribution ? { ...contribution, creditsAwarded: Number(contribution.creditsAwarded ?? 0), authorityGranted: false } : null;
}

export async function reserveResultAccess(db, agentId, resultId) {
  const normalizedResultId = resultId?.trim().slice(0, 240);
  const queryId = normalizedResultId?.startsWith("working-route:") ? normalizedResultId.slice("working-route:".length) : "";
  if (!/^routeq_[A-Za-z0-9]+$/.test(queryId)) return { ok: false, status: 400, error: "invalid_result_id" };

  const query = await storedRouteQuery(db, queryId);
  if (!query || query.agentId !== agentId) return { ok: false, status: 404, error: "working_route_query_not_found" };
  const records = await routeRecordsForQuery(db, query);
  const assessment = evaluateWorkingRoute(records, query, now());
  if (assessment.status !== "RESULT_AVAILABLE" || !assessment.workingRoute) {
    return { ok: false, status: 409, error: "working_route_not_available" };
  }

  const prior = await db.prepare(`SELECT id FROM exchange_credit_entries
    WHERE agent_id = ? AND result_id = ? AND entry_type = 'spend'`)
    .bind(agentId, normalizedResultId).first();
  if (prior) return { ok: false, status: 409, error: "result_already_unlocked" };

  const account = await getAgentAccount(db, agentId);
  if (!account || account.creditBalance < 1) {
    return { ok: false, status: 403, error: "accepted_contribution_required" };
  }

  const dayStart = `${now().slice(0, 10)}T00:00:00.000Z`;
  try {
    const result = await db.prepare(`INSERT INTO exchange_credit_entries
      (id, agent_id, result_id, entry_type, credits, created_at)
      SELECT ?, id, ?, 'spend', -1, ?
      FROM exchange_agents
      WHERE id = ? AND status = 'active'
        AND (SELECT COALESCE(SUM(credits), 0) FROM exchange_credit_entries WHERE agent_id = ?) >= 1
        AND (daily_credit_spend_limit = 0 OR
          (SELECT COUNT(*) FROM exchange_credit_entries
           WHERE agent_id = ? AND entry_type = 'spend' AND created_at >= ?) < daily_credit_spend_limit)`)
      .bind(newId("credit"), normalizedResultId, now(), agentId, agentId, agentId, dayStart)
      .run();
    if (Number(result?.meta?.changes ?? 0) !== 1) {
      return { ok: false, status: 429, error: "credit_or_daily_limit_unavailable" };
    }
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return { ok: false, status: 409, error: "result_already_unlocked" };
    }
    throw error;
  }

  const updated = await getAgentAccount(db, agentId);
  return {
    ok: true,
    status: 200,
    access: {
      resultId: normalizedResultId,
      creditsSpent: 1,
      creditBalance: updated?.creditBalance ?? account.creditBalance - 1,
      releaseStatus: "READY_FOR_BOUND_AUTHORIZATION",
      authorityGranted: false,
      controllerIndependenceVerified: false,
      executionTruthVerified: false,
      routeReceipt: {
        schema: "minority-prophet.working-route-release.v0.1",
        queryId,
        workingRoute: assessment.workingRoute,
        evidence: assessment.evidence,
        issuedAt: now(),
        gateRequired: true,
        authorityGranted: false,
        controllerIndependenceVerified: false,
        executionTruthVerified: false,
      },
      nextAction: "Return this bounded route receipt to Gate for purpose-bound release.",
    },
  };
}

function shortText(value, maximum) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : null;
}

function safeIdentifier(value, maximum, allowScope = false) {
  const normalized = shortText(value, maximum);
  const pattern = allowScope ? /^[A-Za-z0-9@][A-Za-z0-9._@/+~-]*$/ : /^[A-Za-z0-9][A-Za-z0-9._+~-]*$/;
  return normalized && pattern.test(normalized) ? normalized : null;
}

function safeProvenanceRoot(value) {
  const normalized = shortText(value, 240);
  if (!normalized) return null;
  if (/^sha256:[a-fA-F0-9]{64}$/.test(normalized)) return normalized;
  return /^[A-Za-z0-9][A-Za-z0-9._+~-]*$/.test(normalized) ? normalized : null;
}

export function validateRouteQuery(body) {
  if (!body || Object.keys(body).some((key) => !routeQueryFields.has(key))) return null;
  if (body.schema != null && body.schema !== "minority-prophet.working-route-query.v0.1") return null;
  const toolId = safeIdentifier(body?.toolId, 200, true);
  const attemptedToolVersion = safeIdentifier(body?.attemptedToolVersion, 80);
  const clientId = safeIdentifier(body?.clientId, 120);
  const attemptedClientVersion = safeIdentifier(body?.attemptedClientVersion, 80);
  const operation = safeIdentifier(body?.operation, 120);
  const localEvidenceReceiptHash = shortText(body?.localEvidenceReceiptHash, 160);
  if (!toolRegistries.has(body?.toolRegistry) || !toolId || !attemptedToolVersion || !clientId || !attemptedClientVersion || !operation) return null;
  if (!environments.has(body.environment) || !authModes.has(body.authMode)) return null;
  if (body.localEvidenceStatus !== "insufficient" || !/^sha256:[a-fA-F0-9-]{8,128}$/.test(localEvidenceReceiptHash ?? "")) return null;
  if (!Number.isInteger(body.maxAgeDays) || body.maxAgeDays < 1 || body.maxAgeDays > 30) return null;
  if (!Number.isInteger(body.minimumIndependentRoots) || body.minimumIndependentRoots < 2 || body.minimumIndependentRoots > 10) return null;
  return { toolRegistry: body.toolRegistry, toolId, attemptedToolVersion, clientId, attemptedClientVersion, environment: body.environment, authMode: body.authMode, operation, localEvidenceStatus: body.localEvidenceStatus, localEvidenceReceiptHash, maxAgeDays: body.maxAgeDays, minimumIndependentRoots: body.minimumIndependentRoots };
}

async function routeRecordsForQuery(db, query) {
  const response = await db.prepare(`SELECT
      c.agent_id AS agentId,
      c.status AS status,
      c.provenance_root_id AS provenanceRootId,
      c.independence_basis AS independenceBasis,
      r.tool_registry AS toolRegistry,
      r.tool_id AS toolId,
      r.tool_version AS toolVersion,
      r.client_id AS clientId,
      r.client_version AS clientVersion,
      r.environment AS environment,
      r.auth_mode AS authMode,
      r.operation AS operation,
      r.outcome AS outcome,
      r.error_class AS errorClass,
      r.resolution_kind AS resolutionKind,
      r.route_fingerprint AS routeFingerprint,
      r.observed_at AS observedAt,
      COALESCE(a.verification_level, 'exchange-verifier-v0') AS verificationLevel
    FROM exchange_working_route_comps r
    JOIN exchange_contributions c ON c.id = r.contribution_id
    LEFT JOIN exchange_working_route_attestations a ON a.contribution_id = c.id
    WHERE c.status = 'accepted' AND r.tool_registry = ? AND r.tool_id = ? AND r.client_id = ?
      AND r.environment = ? AND r.auth_mode = ? AND r.operation = ?`)
    .bind(query.toolRegistry, query.toolId, query.clientId, query.environment, query.authMode, query.operation).all();
  return response?.results ?? [];
}

function validateAttestation(value) {
  if (!value || value.algorithm !== "Ed25519") return null;
  if (!/^wexkey_[a-f0-9]{24}$/.test(value.keyId ?? "")) return null;
  if (!/^[A-Za-z0-9_-]{64,160}$/.test(value.signature ?? "")) return null;
  return { algorithm: "Ed25519", keyId: value.keyId, signature: value.signature };
}

async function verifyWorkingRouteAttestation(db, agentId, body) {
  const attestation = validateAttestation(body?.attestation);
  if (!attestation) return { ok: false, error: "signed_route_receipt_required" };
  const key = await db.prepare(`SELECT key_id AS keyId, algorithm, public_key_spki AS publicKeySpki
    FROM exchange_agent_signing_keys WHERE key_id = ? AND agent_id = ? AND status = 'active'`)
    .bind(attestation.keyId, agentId).first();
  if (!key || key.algorithm !== "Ed25519") return { ok: false, error: "unrecognized_agent_signing_key" };
  try {
    const publicKey = await crypto.subtle.importKey("spki", base64UrlToBytes(key.publicKeySpki), { name: "Ed25519" }, false, ["verify"]);
    const valid = await crypto.subtle.verify({ name: "Ed25519" }, publicKey, base64UrlToBytes(attestation.signature), receiptSigningBytes(body));
    if (!valid) return { ok: false, error: "invalid_route_receipt_signature" };
  } catch {
    return { ok: false, error: "invalid_route_receipt_signature" };
  }
  return { ok: true, attestation, receiptHash: await receiptHash(body), verificationLevel: "distinct-signed-node-v1" };
}

async function routeSupportCandidateKey(input) {
  return sha256(canonicalJson({
    toolRegistry: input.toolRegistry,
    toolId: input.toolId,
    toolVersion: input.toolVersion,
    clientId: input.clientId,
    clientVersion: input.clientVersion,
    environment: input.environment,
    authMode: input.authMode,
    operation: input.operation,
    outcome: input.outcome,
    resolutionKind: input.resolutionKind,
    routeFingerprint: input.routeFingerprint,
  }));
}

async function recordCollapsedVerification(db, contributionId, verifierReceiptId, reason) {
  const verifiedAt = now();
  await db.batch([
    db.prepare(`UPDATE exchange_contributions SET status = 'collapsed' WHERE id = ? AND status = 'pending'`).bind(contributionId),
    db.prepare(`INSERT INTO exchange_verification_records
      (id, contribution_id, verifier_receipt_id, decision, independently_additive, reason, created_at)
      VALUES (?, ?, ?, 'collapsed', 0, ?, ?)`).bind(newId("verification"), contributionId, verifierReceiptId, reason, verifiedAt),
  ]);
  return { ok: true, status: 200, creditsAwarded: 0, verificationDecision: "collapsed", independentlyAdditive: false };
}

async function acceptSignedRouteContribution(db, { contributionId, agentId, candidateKey, verifierReceiptId }) {
  const contribution = await db.prepare(`SELECT freshness_days AS freshnessDays FROM exchange_contributions
    WHERE id = ? AND agent_id = ? AND status = 'pending'`).bind(contributionId, agentId).first();
  if (!contribution) return { ok: false, status: 409, error: "contribution_not_pending" };
  const credits = creditsForAcceptedContribution({ accepted: true, independentlyAdditive: true, freshnessDays: Number(contribution.freshnessDays) });
  const acceptedAt = now();
  try {
    await db.batch([
      db.prepare(`INSERT INTO exchange_route_support_claims
        (agent_id, candidate_key, contribution_id, created_at) VALUES (?, ?, ?, ?)`)
        .bind(agentId, candidateKey, contributionId, acceptedAt),
      db.prepare(`UPDATE exchange_contributions SET status = 'accepted', verifier_receipt_id = ?, accepted_at = ?
        WHERE id = ? AND status = 'pending'`).bind(verifierReceiptId, acceptedAt, contributionId),
      db.prepare(`INSERT INTO exchange_verification_records
        (id, contribution_id, verifier_receipt_id, decision, independently_additive, reason, created_at)
        VALUES (?, ?, ?, 'accepted', 1, 'distinct_signed_node_first_support_for_candidate', ?)`)
        .bind(newId("verification"), contributionId, verifierReceiptId, acceptedAt),
      db.prepare(`INSERT INTO exchange_credit_entries
        (id, agent_id, contribution_id, verifier_receipt_id, entry_type, credits, created_at)
        VALUES (?, ?, ?, ?, 'earn', ?, ?)`)
        .bind(newId("credit"), agentId, contributionId, verifierReceiptId, credits, acceptedAt),
    ]);
  } catch (error) {
    if (!String(error).toLowerCase().includes("unique")) throw error;
    return recordCollapsedVerification(db, contributionId, verifierReceiptId, "same_signed_node_already_supports_candidate");
  }
  const linkedRoute = await db.prepare(`SELECT query_id AS queryId FROM exchange_working_route_comps WHERE contribution_id = ?`)
    .bind(contributionId).first();
  const queryStatus = linkedRoute?.queryId ? await reassessStoredRouteQuery(db, linkedRoute.queryId) : null;
  return { ok: true, status: 201, creditsAwarded: credits, verificationDecision: "accepted", independentlyAdditive: true, queryStatus };
}

async function storedRouteQuery(db, queryId) {
  return db.prepare(`SELECT id AS queryId, agent_id AS agentId, tool_registry AS toolRegistry, tool_id AS toolId, attempted_tool_version AS attemptedToolVersion,
      client_id AS clientId, attempted_client_version AS attemptedClientVersion, environment,
      auth_mode AS authMode, operation, local_evidence_status AS localEvidenceStatus,
      max_age_days AS maxAgeDays, minimum_independent_roots AS minimumIndependentRoots
    FROM exchange_route_queries WHERE id = ?`).bind(queryId).first();
}

export async function getRouteQueryStatus(db, agentId, queryId) {
  const query = await storedRouteQuery(db, queryId);
  if (!query || query.agentId !== agentId) return null;
  const records = await routeRecordsForQuery(db, query);
  const assessment = evaluateWorkingRoute(records, query, now());
  if (assessment.status !== query.status) {
    await db.prepare(`UPDATE exchange_route_queries SET status = ? WHERE id = ?`).bind(assessment.status, queryId).run();
  }
  return {
    queryId,
    status: assessment.status,
    resultId: `working-route:${queryId}`,
    resultSealed: assessment.status === "RESULT_AVAILABLE",
    evidence: assessment.evidence,
    bounty: assessment.bounty,
    authorityGranted: false,
  };
}

async function reassessStoredRouteQuery(db, queryId) {
  const query = await storedRouteQuery(db, queryId);
  if (!query) return null;
  const records = await routeRecordsForQuery(db, query);
  const assessment = evaluateWorkingRoute(records, query, now());
  await db.prepare(`UPDATE exchange_route_queries SET status = ? WHERE id = ?`)
    .bind(assessment.status, queryId).run();
  return assessment.status;
}

export async function createRouteQuery(db, agentId, body) {
  const input = validateRouteQuery(body);
  if (!input) return { ok: false, status: 400, error: "invalid_working_route_query" };
  const prior = await db.prepare(`SELECT id AS queryId FROM exchange_route_queries
    WHERE agent_id = ? AND local_evidence_receipt_hash = ?`)
    .bind(agentId, input.localEvidenceReceiptHash).first();
  if (prior) {
    const query = await getRouteQueryStatus(db, agentId, prior.queryId);
    return { ok: true, status: 200, query: { ...query, idempotentReplay: true } };
  }
  const queryId = newId("routeq");
  const records = await routeRecordsForQuery(db, input);
  const assessment = evaluateWorkingRoute(records, input, now());
  try {
    await db.prepare(`INSERT INTO exchange_route_queries
      (id, agent_id, tool_registry, tool_id, attempted_tool_version, client_id, attempted_client_version,
       environment, auth_mode, operation, local_evidence_status, local_evidence_receipt_hash,
       max_age_days, minimum_independent_roots, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(queryId, agentId, input.toolRegistry, input.toolId, input.attemptedToolVersion, input.clientId, input.attemptedClientVersion,
        input.environment, input.authMode, input.operation, input.localEvidenceStatus, input.localEvidenceReceiptHash,
        input.maxAgeDays, input.minimumIndependentRoots, assessment.status, now()).run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      const replay = await db.prepare(`SELECT id AS queryId FROM exchange_route_queries
        WHERE agent_id = ? AND local_evidence_receipt_hash = ?`)
        .bind(agentId, input.localEvidenceReceiptHash).first();
      if (replay) {
        const query = await getRouteQueryStatus(db, agentId, replay.queryId);
        return { ok: true, status: 200, query: { ...query, idempotentReplay: true } };
      }
    }
    throw error;
  }
  return {
    ok: true,
    status: 201,
    query: {
      queryId,
      status: assessment.status,
      resultId: `working-route:${queryId}`,
      resultSealed: assessment.status === "RESULT_AVAILABLE",
      evidence: assessment.evidence,
      bounty: assessment.bounty,
      nextAction: assessment.status === "RESULT_AVAILABLE"
        ? "Spend one earned credit to send the sealed route to Gate for bounded release."
        : assessment.nextAction,
      authorityGranted: false,
    },
  };
}

export function validateWorkingRouteComp(body) {
  if (!body || Object.keys(body).some((key) => !workingRouteCompFields.has(key))) return null;
  if (body.schema != null && !["minority-prophet.working-route-comp.v0.1", "agentwex.working-route-comp.v0.2"].includes(body.schema)) return null;
  const toolId = safeIdentifier(body.toolId, 200, true);
  const toolVersion = safeIdentifier(body.toolVersion, 80);
  const clientId = safeIdentifier(body.clientId, 120);
  const clientVersion = safeIdentifier(body.clientVersion, 80);
  const operation = safeIdentifier(body.operation, 120);
  const provenanceRootId = safeProvenanceRoot(body.provenanceRootId);
  const routeFingerprint = shortText(body.routeFingerprint, 160);
  const errorClass = body.errorClass == null ? null : safeIdentifier(body.errorClass, 120);
  if (!toolRegistries.has(body.toolRegistry) || !toolId || !toolVersion || !clientId || !clientVersion || !operation || !provenanceRootId) return null;
  if (!environments.has(body.environment) || !authModes.has(body.authMode) || !resolutionKinds.has(body.resolutionKind)) return null;
  if (!["success", "failure"].includes(body.outcome) || !["attested", "declared", "inferred", "unknown"].includes(body.independenceBasis)) return null;
  if (!/^sha256:[a-fA-F0-9-]{8,128}$/.test(routeFingerprint ?? "") || Number.isNaN(Date.parse(body.observedAt))) return null;
  if (body.outcome === "failure" && !errorClass) return null;
  const attestation = body.attestation == null ? null : validateAttestation(body.attestation);
  if (body.attestation != null && !attestation) return null;
  if (body.schema === "agentwex.working-route-comp.v0.2" && !attestation) return null;
  return { schema: body.schema ?? "minority-prophet.working-route-comp.v0.1", queryId: safeIdentifier(body.queryId, 240), toolRegistry: body.toolRegistry, toolId, toolVersion, clientId, clientVersion, environment: body.environment, authMode: body.authMode, operation, outcome: body.outcome, errorClass, resolutionKind: body.resolutionKind, routeFingerprint, observedAt: new Date(body.observedAt).toISOString(), provenanceRootId, independenceBasis: body.independenceBasis, attestation };
}

export async function submitWorkingRouteComp(db, agentId, body) {
  const input = validateWorkingRouteComp(body);
  if (!input) return { ok: false, status: 400, error: "invalid_or_sensitive_working_route_comp" };
  const signedReceipt = input.schema === "agentwex.working-route-comp.v0.2";
  const verified = signedReceipt ? await verifyWorkingRouteAttestation(db, agentId, body) : null;
  if (signedReceipt && !verified?.ok) return { ok: false, status: 401, error: verified?.error ?? "route_receipt_verification_failed" };
  if (body.queryId && !input.queryId) return { ok: false, status: 400, error: "invalid_query_id" };
  if (input.queryId && !(await storedRouteQuery(db, input.queryId))) {
    return { ok: false, status: 404, error: "working_route_query_not_found" };
  }
  const contributionId = newId("routecomp");
  const freshnessDays = Math.max(0, Math.floor((Date.now() - Date.parse(input.observedAt)) / 86_400_000));
  const topic = `${input.toolId}|${input.clientId}|${input.environment}|${input.authMode}|${input.operation}`;
  const dedupeKey = await contributionDedupeKey(agentId, "working-route", {
    ...input,
    queryId: null,
  });
  const prior = await contributionByDedupeKey(db, agentId, dedupeKey);
  if (prior) return { ok: true, status: 200, contribution: { ...prior, kind: "working-route", idempotentReplay: true, sensitivePayloadStored: false, authorityGranted: false } };
  const createdAt = now();
  try {
    const statements = [
      db.prepare(`INSERT INTO exchange_contributions
        (id, agent_id, record_kind, topic, provenance_root_id, independence_basis, freshness_days, status, created_at)
        VALUES (?, ?, 'working-route', ?, ?, ?, ?, 'pending', ?)`)
        .bind(contributionId, agentId, topic, input.provenanceRootId, input.independenceBasis, freshnessDays, createdAt),
      db.prepare(`INSERT INTO exchange_working_route_comps
        (contribution_id, query_id, tool_registry, tool_id, tool_version, client_id, client_version, environment,
         auth_mode, operation, outcome, error_class, resolution_kind, route_fingerprint, observed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(contributionId, input.queryId, input.toolRegistry, input.toolId, input.toolVersion, input.clientId, input.clientVersion,
          input.environment, input.authMode, input.operation, input.outcome, input.errorClass,
          input.resolutionKind, input.routeFingerprint, input.observedAt),
      db.prepare(`INSERT INTO exchange_submission_keys
        (agent_id, dedupe_key, contribution_id, created_at) VALUES (?, ?, ?, ?)`)
        .bind(agentId, dedupeKey, contributionId, createdAt),
    ];
    if (verified?.ok) {
      statements.push(db.prepare(`INSERT INTO exchange_working_route_attestations
        (contribution_id, agent_id, key_id, receipt_hash, signature, verification_level, verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(contributionId, agentId, verified.attestation.keyId, verified.receiptHash,
          verified.attestation.signature, verified.verificationLevel, createdAt));
    }
    await db.batch(statements);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      const replay = await contributionByDedupeKey(db, agentId, dedupeKey);
      if (replay) return { ok: true, status: 200, contribution: { ...replay, kind: "working-route", idempotentReplay: true, sensitivePayloadStored: false, authorityGranted: false } };
    }
    throw error;
  }
  if (verified?.ok) {
    const candidateKey = await routeSupportCandidateKey(input);
    const verifierReceiptId = `wex:auto:v1:${verified.receiptHash.slice("sha256:".length, 37)}`;
    const accepted = await acceptSignedRouteContribution(db, { contributionId, agentId, candidateKey, verifierReceiptId });
    if (!accepted.ok) return accepted;
    const acceptedStatus = accepted.verificationDecision === "collapsed" ? "collapsed" : "accepted";
    return { ok: true, status: accepted.status, contribution: {
      contributionId, kind: "working-route", status: acceptedStatus, creditsAwarded: accepted.creditsAwarded,
      verificationDecision: accepted.verificationDecision, verificationLevel: verified.verificationLevel,
      queryStatus: accepted.queryStatus, sensitivePayloadStored: false, authorityGranted: false,
    } };
  }
  return { ok: true, status: 202, contribution: { contributionId, kind: "working-route", status: "pending", creditsAwarded: 0, sensitivePayloadStored: false, authorityGranted: false } };
}

export async function listOpenRouteBounties(db) {
  const response = await db.prepare(`SELECT id AS queryId, tool_registry AS toolRegistry, tool_id AS toolId, attempted_tool_version AS attemptedToolVersion,
      client_id AS clientId, attempted_client_version AS attemptedClientVersion, environment, auth_mode AS authMode,
      operation, minimum_independent_roots AS minimumIndependentRoots, status, created_at AS createdAt
    FROM exchange_route_queries WHERE status IN ('BOUNTY_OPEN', 'SEEK_MORE_INDEPENDENT_RUNS')
    ORDER BY created_at DESC LIMIT 50`).all();
  return (response?.results ?? []).map((query) => ({ ...query, arbitraryExecutionAuthorized: false }));
}
