CREATE TABLE IF NOT EXISTS exchange_route_releases (
  result_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  query_id TEXT NOT NULL REFERENCES exchange_route_queries(id),
  route_fingerprint TEXT NOT NULL,
  tool_version TEXT NOT NULL,
  client_version TEXT NOT NULL,
  resolution_kind TEXT NOT NULL,
  issued_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_route_feedback (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  result_id TEXT NOT NULL UNIQUE REFERENCES exchange_route_releases(result_id),
  outcome TEXT NOT NULL CHECK(outcome IN ('succeeded', 'failed', 'not-attempted')),
  failure_class TEXT,
  attempts_avoided INTEGER NOT NULL DEFAULT 0 CHECK(attempts_avoided BETWEEN 0 AND 100),
  estimated_tokens_avoided INTEGER NOT NULL DEFAULT 0 CHECK(estimated_tokens_avoided BETWEEN 0 AND 1000000000),
  estimated_latency_ms_avoided INTEGER NOT NULL DEFAULT 0 CHECK(estimated_latency_ms_avoided BETWEEN 0 AND 86400000),
  created_at TEXT NOT NULL,
  CHECK((outcome = 'failed' AND failure_class IN ('authentication', 'compatibility', 'timeout', 'rate-limit', 'network', 'unavailable', 'policy', 'other'))
    OR (outcome != 'failed' AND failure_class IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_exchange_route_releases_fingerprint
ON exchange_route_releases(route_fingerprint, issued_at);

CREATE INDEX IF NOT EXISTS idx_exchange_route_feedback_created
ON exchange_route_feedback(created_at);

PRAGMA optimize;
