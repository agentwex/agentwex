CREATE TABLE IF NOT EXISTS exchange_agent_genesis (
  genesis_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE REFERENCES exchange_agents(id),
  schema_version TEXT NOT NULL,
  genesis_kind TEXT NOT NULL CHECK(genesis_kind IN ('exchange-registration', 'legacy-backfill')),
  genesis_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  identity_provider TEXT NOT NULL,
  delivery_channel TEXT NOT NULL,
  derivation_type TEXT NOT NULL CHECK(derivation_type IN ('unreported', 'unknown', 'original', 'clone', 'restore', 'delegated-spawn')),
  parent_agent_id TEXT REFERENCES exchange_agents(id),
  initial_signing_key_id TEXT REFERENCES exchange_agent_signing_keys(key_id),
  artifact_name TEXT,
  artifact_version TEXT,
  environment TEXT,
  runtime_inventory_json TEXT NOT NULL DEFAULT '[]',
  assurance_level TEXT NOT NULL,
  record_digest TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_exchange_genesis_time
ON exchange_agent_genesis(genesis_at);

CREATE INDEX IF NOT EXISTS idx_exchange_genesis_parent
ON exchange_agent_genesis(parent_agent_id);
