CREATE TABLE IF NOT EXISTS exchange_research_bounties (
  id TEXT PRIMARY KEY,
  publisher_agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  source_system TEXT NOT NULL CHECK(source_system = 'invention-graph'),
  source_bounty_id TEXT NOT NULL,
  title TEXT NOT NULL,
  research_question TEXT NOT NULL,
  acceptance_criteria_json TEXT NOT NULL,
  falsification_criterion TEXT NOT NULL,
  required_observations INTEGER NOT NULL CHECK(required_observations BETWEEN 1 AND 1000000),
  minimum_independent_roots INTEGER NOT NULL CHECK(minimum_independent_roots BETWEEN 1 AND 100),
  safety_constraints_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  publication_receipt_digest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'collecting', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(publisher_agent_id, source_system, source_bounty_id),
  UNIQUE(publication_receipt_digest)
);

CREATE TABLE IF NOT EXISTS exchange_research_bounty_submissions (
  id TEXT PRIMARY KEY,
  bounty_id TEXT NOT NULL REFERENCES exchange_research_bounties(id),
  agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  public_artifact_url TEXT NOT NULL,
  artifact_digest TEXT NOT NULL,
  method_summary TEXT NOT NULL,
  observation_count INTEGER NOT NULL CHECK(observation_count BETWEEN 0 AND 10000000),
  criterion_evidence_json TEXT NOT NULL,
  provenance_roots_json TEXT NOT NULL,
  reproducibility_receipt_digest TEXT,
  quality_json TEXT NOT NULL,
  structural_score INTEGER NOT NULL CHECK(structural_score BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate', 'reviewed', 'rejected')),
  submitted_at TEXT NOT NULL,
  UNIQUE(bounty_id, agent_id, artifact_digest)
);

CREATE INDEX IF NOT EXISTS idx_exchange_research_bounties_status
ON exchange_research_bounties(status, expires_at, created_at);

CREATE INDEX IF NOT EXISTS idx_exchange_research_submissions_quality
ON exchange_research_bounty_submissions(bounty_id, structural_score, submitted_at);

PRAGMA optimize;
