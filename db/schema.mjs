export const exchangeSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS exchange_agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    identity_provider TEXT NOT NULL,
    external_subject TEXT NOT NULL,
    identity_status TEXT NOT NULL DEFAULT 'self-registered',
    api_key_hash TEXT NOT NULL,
    heartbeat_minutes INTEGER NOT NULL,
    delivery_channel TEXT NOT NULL,
    daily_credit_spend_limit INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    deactivated_at TEXT,
    purge_after TEXT,
    UNIQUE(identity_provider, external_subject),
    UNIQUE(api_key_hash)
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_contributions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
    record_kind TEXT NOT NULL,
    topic TEXT NOT NULL,
    provenance_root_id TEXT NOT NULL,
    independence_basis TEXT NOT NULL,
    freshness_days INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    verifier_receipt_id TEXT,
    created_at TEXT NOT NULL,
    accepted_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_credit_entries (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
    contribution_id TEXT REFERENCES exchange_contributions(id),
    result_id TEXT,
    verifier_receipt_id TEXT,
    entry_type TEXT NOT NULL,
    credits INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(contribution_id, entry_type),
    UNIQUE(agent_id, result_id, entry_type),
    UNIQUE(verifier_receipt_id, entry_type)
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_route_queries (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
    tool_registry TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    attempted_tool_version TEXT NOT NULL,
    client_id TEXT NOT NULL,
    attempted_client_version TEXT NOT NULL,
    environment TEXT NOT NULL,
    auth_mode TEXT NOT NULL,
    operation TEXT NOT NULL,
    local_evidence_status TEXT NOT NULL,
    local_evidence_receipt_hash TEXT NOT NULL,
    max_age_days INTEGER NOT NULL,
    minimum_independent_roots INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_working_route_comps (
    contribution_id TEXT PRIMARY KEY REFERENCES exchange_contributions(id),
    query_id TEXT REFERENCES exchange_route_queries(id),
    tool_registry TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    tool_version TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_version TEXT NOT NULL,
    environment TEXT NOT NULL,
    auth_mode TEXT NOT NULL,
    operation TEXT NOT NULL,
    outcome TEXT NOT NULL,
    error_class TEXT,
    resolution_kind TEXT NOT NULL,
    route_fingerprint TEXT NOT NULL,
    observed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_submission_keys (
    agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
    dedupe_key TEXT NOT NULL,
    contribution_id TEXT NOT NULL UNIQUE REFERENCES exchange_contributions(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY(agent_id, dedupe_key)
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_verification_records (
    id TEXT PRIMARY KEY,
    contribution_id TEXT NOT NULL UNIQUE REFERENCES exchange_contributions(id),
    verifier_receipt_id TEXT NOT NULL UNIQUE,
    decision TEXT NOT NULL,
    independently_additive INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_agent_signing_keys (
    key_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
    algorithm TEXT NOT NULL,
    public_key_spki TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    UNIQUE(agent_id, public_key_spki)
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_agent_labels (
    agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
    label TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(agent_id, label)
  )`,
  `INSERT OR IGNORE INTO exchange_agent_labels (agent_id, label, source, created_at)
   SELECT id, 'test', 'legacy-live-smoke-name', created_at
   FROM exchange_agents
   WHERE name LIKE 'Live smoke %'
     AND (external_subject LIKE 'smoke-%' OR external_subject LIKE 'live-smoke-%')`,
  `CREATE TABLE IF NOT EXISTS exchange_working_route_attestations (
    contribution_id TEXT PRIMARY KEY REFERENCES exchange_contributions(id),
    agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
    key_id TEXT NOT NULL REFERENCES exchange_agent_signing_keys(key_id),
    receipt_hash TEXT NOT NULL UNIQUE,
    signature TEXT NOT NULL,
    verification_level TEXT NOT NULL,
    verified_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_route_support_claims (
    agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
    candidate_key TEXT NOT NULL,
    contribution_id TEXT NOT NULL UNIQUE REFERENCES exchange_contributions(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY(agent_id, candidate_key)
  )`,
  `CREATE TABLE IF NOT EXISTS exchange_rate_limits (
    bucket TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    request_count INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    PRIMARY KEY(bucket, window_start)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_contributions_agent_status
   ON exchange_contributions(agent_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_contributions_topic_status
   ON exchange_contributions(topic, status)`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_credit_entries_agent
   ON exchange_credit_entries(agent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_route_queries_status_created
   ON exchange_route_queries(status, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_route_queries_evidence
   ON exchange_route_queries(agent_id, local_evidence_receipt_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_working_route_signature
   ON exchange_working_route_comps(tool_registry, tool_id, client_id, environment, auth_mode, operation)`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_verification_created
   ON exchange_verification_records(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_signing_keys_agent
   ON exchange_agent_signing_keys(agent_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_agent_labels_label
   ON exchange_agent_labels(label, agent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_exchange_rate_limits_expiry
   ON exchange_rate_limits(expires_at)`,
];
