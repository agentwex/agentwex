CREATE TABLE IF NOT EXISTS exchange_agent_controller_groups (
  agent_id TEXT PRIMARY KEY REFERENCES exchange_agents(id),
  controller_group_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  evidence_scope TEXT NOT NULL CHECK(evidence_scope IN ('lab', 'community')),
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exchange_controller_groups_scope
ON exchange_agent_controller_groups(evidence_scope, controller_group_id, participant_id);
