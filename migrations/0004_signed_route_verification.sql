CREATE TABLE IF NOT EXISTS exchange_agent_signing_keys (
  key_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  algorithm TEXT NOT NULL,
  public_key_spki TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(agent_id, public_key_spki)
);

CREATE TABLE IF NOT EXISTS exchange_working_route_attestations (
  contribution_id TEXT PRIMARY KEY REFERENCES exchange_contributions(id),
  agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  key_id TEXT NOT NULL REFERENCES exchange_agent_signing_keys(key_id),
  receipt_hash TEXT NOT NULL UNIQUE,
  signature TEXT NOT NULL,
  verification_level TEXT NOT NULL,
  verified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_route_support_claims (
  agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  candidate_key TEXT NOT NULL,
  contribution_id TEXT NOT NULL UNIQUE REFERENCES exchange_contributions(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(agent_id, candidate_key)
);

CREATE INDEX IF NOT EXISTS idx_exchange_signing_keys_agent
ON exchange_agent_signing_keys(agent_id, status);

PRAGMA optimize;
