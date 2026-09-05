PRAGMA foreign_keys = OFF;

CREATE TABLE exchange_research_bounties_v2 (
  id TEXT PRIMARY KEY,
  publisher_agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  source_system TEXT NOT NULL CHECK(source_system IN ('invention-graph', 'agentwex-community')),
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
  funding_goal_microunits INTEGER NOT NULL DEFAULT 0 CHECK(funding_goal_microunits BETWEEN 0 AND 1000000000000),
  settlement_rail TEXT CHECK(settlement_rail IS NULL OR settlement_rail IN ('taskmarket_escrow', 'x402_direct')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('pending_review', 'funding_pending', 'open', 'collecting', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(publisher_agent_id, source_system, source_bounty_id),
  UNIQUE(publication_receipt_digest)
);

INSERT INTO exchange_research_bounties_v2 (
  id, publisher_agent_id, source_system, source_bounty_id, title, research_question,
  acceptance_criteria_json, falsification_criterion, required_observations,
  minimum_independent_roots, safety_constraints_json, expires_at,
  publication_receipt_digest, funding_goal_microunits, settlement_rail,
  status, created_at, updated_at
)
SELECT id, publisher_agent_id, source_system, source_bounty_id, title, research_question,
  acceptance_criteria_json, falsification_criterion, required_observations,
  minimum_independent_roots, safety_constraints_json, expires_at,
  publication_receipt_digest, 0, NULL, status, created_at, updated_at
FROM exchange_research_bounties;

DROP TABLE exchange_research_bounties;
ALTER TABLE exchange_research_bounties_v2 RENAME TO exchange_research_bounties;

CREATE TABLE exchange_research_bounty_funding_intents (
  id TEXT PRIMARY KEY,
  bounty_id TEXT NOT NULL REFERENCES exchange_research_bounties(id),
  funder_agent_id TEXT NOT NULL REFERENCES exchange_agents(id),
  amount_microunits INTEGER NOT NULL CHECK(amount_microunits BETWEEN 1 AND 1000000000000),
  currency TEXT NOT NULL CHECK(currency = 'USDC'),
  network TEXT NOT NULL CHECK(network = 'eip155:8453'),
  settlement_rail TEXT NOT NULL CHECK(settlement_rail IN ('taskmarket_escrow', 'x402_direct')),
  idempotency_key TEXT NOT NULL,
  external_settlement_id TEXT NOT NULL,
  settlement_receipt_digest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_verification' CHECK(status IN ('awaiting_verification', 'verified', 'rejected')),
  created_at TEXT NOT NULL,
  verified_at TEXT,
  verifier_reference TEXT,
  UNIQUE(funder_agent_id, bounty_id, idempotency_key),
  UNIQUE(settlement_rail, external_settlement_id)
);

CREATE TABLE exchange_research_bounty_reviews (
  id TEXT PRIMARY KEY,
  bounty_id TEXT NOT NULL UNIQUE REFERENCES exchange_research_bounties(id),
  decision TEXT NOT NULL CHECK(decision IN ('approved', 'rejected')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exchange_research_bounties_status
ON exchange_research_bounties(status, expires_at, created_at);

CREATE INDEX IF NOT EXISTS idx_exchange_research_submissions_quality
ON exchange_research_bounty_submissions(bounty_id, structural_score, submitted_at);

CREATE INDEX IF NOT EXISTS idx_exchange_research_funding_status
ON exchange_research_bounty_funding_intents(bounty_id, status, created_at);

PRAGMA foreign_keys = ON;
PRAGMA optimize;
