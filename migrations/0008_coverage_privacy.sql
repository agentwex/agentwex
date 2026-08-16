CREATE TABLE IF NOT EXISTS exchange_agent_labels (
  agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  label TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(agent_id, label)
);

INSERT OR IGNORE INTO exchange_agent_labels (agent_id, label, source, created_at)
SELECT id, 'test', 'legacy-live-smoke-name', created_at
FROM exchange_agents
WHERE name LIKE 'Live smoke %'
  AND (external_subject LIKE 'smoke-%' OR external_subject LIKE 'live-smoke-%');

CREATE INDEX IF NOT EXISTS idx_exchange_agent_labels_label
ON exchange_agent_labels(label, agent_id);
