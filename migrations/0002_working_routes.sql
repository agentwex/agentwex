CREATE TABLE IF NOT EXISTS exchange_route_queries (
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
);

CREATE TABLE IF NOT EXISTS exchange_working_route_comps (
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
);

CREATE INDEX IF NOT EXISTS idx_exchange_route_queries_status_created
ON exchange_route_queries(status, created_at);

CREATE INDEX IF NOT EXISTS idx_exchange_working_route_signature
ON exchange_working_route_comps(tool_registry, tool_id, client_id, environment, auth_mode, operation);

PRAGMA optimize;
