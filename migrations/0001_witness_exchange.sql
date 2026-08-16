CREATE TABLE IF NOT EXISTS exchange_agents (
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
  UNIQUE(identity_provider, external_subject),
  UNIQUE(api_key_hash)
);

CREATE TABLE IF NOT EXISTS exchange_contributions (
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
);

CREATE TABLE IF NOT EXISTS exchange_credit_entries (
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
);

CREATE INDEX IF NOT EXISTS idx_exchange_contributions_agent_status
ON exchange_contributions(agent_id, status);

CREATE INDEX IF NOT EXISTS idx_exchange_contributions_topic_status
ON exchange_contributions(topic, status);

CREATE INDEX IF NOT EXISTS idx_exchange_credit_entries_agent
ON exchange_credit_entries(agent_id);

PRAGMA optimize;
