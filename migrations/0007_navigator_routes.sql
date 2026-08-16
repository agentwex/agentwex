ALTER TABLE exchange_route_queries ADD COLUMN capability_id TEXT;
ALTER TABLE exchange_route_queries ADD COLUMN effect_class TEXT;
ALTER TABLE exchange_route_queries ADD COLUMN alternative_policy TEXT NOT NULL DEFAULT 'exact-only';

ALTER TABLE exchange_working_route_comps ADD COLUMN capability_id TEXT;
ALTER TABLE exchange_working_route_comps ADD COLUMN effect_class TEXT;

ALTER TABLE exchange_route_releases ADD COLUMN match_type TEXT NOT NULL DEFAULT 'COMPATIBLE_ROUTE';
ALTER TABLE exchange_route_releases ADD COLUMN tool_registry TEXT;
ALTER TABLE exchange_route_releases ADD COLUMN tool_id TEXT;
ALTER TABLE exchange_route_releases ADD COLUMN client_id TEXT;
ALTER TABLE exchange_route_releases ADD COLUMN auth_mode TEXT;
ALTER TABLE exchange_route_releases ADD COLUMN operation TEXT;
ALTER TABLE exchange_route_releases ADD COLUMN capability_id TEXT;
ALTER TABLE exchange_route_releases ADD COLUMN effect_class TEXT;

CREATE INDEX IF NOT EXISTS idx_exchange_working_route_capability
ON exchange_working_route_comps(capability_id, effect_class, environment, observed_at);
