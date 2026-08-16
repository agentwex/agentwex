CREATE TABLE IF NOT EXISTS exchange_submission_keys (
  agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  dedupe_key TEXT NOT NULL,
  contribution_id TEXT NOT NULL UNIQUE REFERENCES exchange_contributions(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(agent_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS exchange_verification_records (
  id TEXT PRIMARY KEY,
  contribution_id TEXT NOT NULL UNIQUE REFERENCES exchange_contributions(id),
  verifier_receipt_id TEXT NOT NULL UNIQUE,
  decision TEXT NOT NULL,
  independently_additive INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exchange_verification_created
ON exchange_verification_records(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exchange_route_queries_evidence
ON exchange_route_queries(agent_id, local_evidence_receipt_hash);

PRAGMA optimize;
