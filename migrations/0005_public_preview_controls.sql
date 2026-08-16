ALTER TABLE exchange_agents ADD COLUMN deactivated_at TEXT;
ALTER TABLE exchange_agents ADD COLUMN purge_after TEXT;

CREATE TABLE IF NOT EXISTS exchange_rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY(bucket, window_start)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_limits_expiry
ON exchange_rate_limits(expires_at);
