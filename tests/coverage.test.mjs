import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { ensureExchangeSchema, getPublicCoverage } from "../db/exchange-store.mjs";

function d1TestDatabase({ legacyAgentSchema = false } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  if (legacyAgentSchema) {
    sqlite.exec(`CREATE TABLE exchange_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      identity_provider TEXT NOT NULL,
      external_subject TEXT NOT NULL,
      identity_status TEXT NOT NULL DEFAULT 'self-registered',
      api_key_hash TEXT NOT NULL,
      heartbeat_minutes INTEGER NOT NULL,
      delivery_channel TEXT NOT NULL,
      daily_credit_spend_limit INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      UNIQUE(identity_provider, external_subject),
      UNIQUE(api_key_hash)
    )`);
  }
  const prepare = (sql) => ({
    _values: [],
    bind(...values) { this._values = values; return this; },
    first() { return sqlite.prepare(sql).get(...this._values) ?? null; },
    all() { return { results: sqlite.prepare(sql).all(...this._values) }; },
    run() {
      const result = sqlite.prepare(sql).run(...this._values);
      return { meta: { changes: Number(result.changes) } };
    },
  });
  return {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

test("schema startup upgrades legacy exchange agent rows", async () => {
  const db = d1TestDatabase({ legacyAgentSchema: true });
  await ensureExchangeSchema(db);
  const columns = await db.prepare("PRAGMA table_info(exchange_agents)").all();
  const names = columns.results.map((column) => column.name);
  assert.ok(names.includes("deactivated_at"));
  assert.ok(names.includes("purge_after"));
});

test("public coverage exposes only supported aggregate cells and rounded freshness", async () => {
  const db = d1TestDatabase();
  await ensureExchangeSchema(db);
  for (const id of ["agent-a", "agent-b", "agent-c", "agent-smoke-a", "agent-smoke-b", "agent-lab-a", "agent-lab-b"]) {
    await db.prepare(`INSERT INTO exchange_agents
      (id, name, identity_provider, external_subject, api_key_hash, heartbeat_minutes, delivery_channel, created_at)
      VALUES (?, ?, 'custom', ?, ?, 15, 'nexus-api', '2026-08-01T00:00:00.000Z')`)
      .bind(id, id, id, `hash-${id}`).run();
  }
  const rows = [
    ["comp-a", "agent-a", "sha256:root-a", "sha256:route-shared", "2026-08-15T10:00:00.000Z", "3.2.0"],
    ["comp-b", "agent-b", "sha256:root-b", "sha256:route-shared", "2026-08-15T12:00:00.000Z", "3.2.0"],
    ["comp-c", "agent-c", "sha256:root-c", "sha256:route-sparse", "2026-08-16T08:00:00.000Z", "9.9.9"],
    ["comp-smoke-a", "agent-smoke-a", "sha256:root-smoke-a", "sha256:route-smoke", "2026-08-16T09:00:00.000Z", "8.8.8"],
    ["comp-smoke-b", "agent-smoke-b", "sha256:root-smoke-b", "sha256:route-smoke", "2026-08-16T09:01:00.000Z", "8.8.8"],
    ["comp-lab-a", "agent-lab-a", "sha256:root-lab-a", "sha256:route-lab", "2026-08-16T10:00:00.000Z", "7.7.7"],
    ["comp-lab-b", "agent-lab-b", "sha256:root-lab-b", "sha256:route-lab", "2026-08-16T10:01:00.000Z", "7.7.7"],
  ];
  for (const [contributionId, agentId, rootId, fingerprint, observedAt, toolVersion] of rows) {
    await db.prepare(`INSERT INTO exchange_contributions
      (id, agent_id, record_kind, topic, provenance_root_id, independence_basis, freshness_days, status, created_at, accepted_at)
      VALUES (?, ?, 'working-route', 'public-tool-compatibility', ?, 'attested', 0, 'accepted', ?, ?)`)
      .bind(contributionId, agentId, rootId, observedAt, observedAt).run();
    await db.prepare(`INSERT INTO exchange_working_route_comps
      (contribution_id, tool_registry, tool_id, tool_version, client_id, client_version, environment,
       auth_mode, operation, outcome, resolution_kind, route_fingerprint, observed_at)
      VALUES (?, 'mcp', 'io.github.example/tool', ?, 'codex', '1.0.0', 'macos-arm64',
       'oauth-pkce', 'repository-search', 'success', 'upgrade-tool', ?, ?)`)
      .bind(contributionId, toolVersion, fingerprint, observedAt).run();
  }
  for (const id of ["agent-smoke-a", "agent-smoke-b"]) {
    await db.prepare(`INSERT INTO exchange_agent_labels (agent_id, label, source, created_at)
      VALUES (?, 'test', 'coverage-unit-test', '2026-08-16T09:02:00.000Z')`).bind(id).run();
  }
  for (const [agentId, participantId] of [["agent-lab-a", "lab-macos-a"], ["agent-lab-b", "lab-macos-b"]]) {
    await db.prepare(`INSERT INTO exchange_agent_controller_groups
      (agent_id, controller_group_id, participant_id, evidence_scope, source, created_at)
      VALUES (?, 'agentwex-first-party-lab', ?, 'lab', 'coverage-unit-test', '2026-08-16T10:02:00.000Z')`)
      .bind(agentId, participantId).run();
  }

  const coverage = await getPublicCoverage(db, Date.parse("2026-08-16T12:00:00.000Z"));
  assert.equal(coverage.cells.length, 1);
  assert.equal(coverage.cells[0].toolVersion, "3.2.0");
  assert.equal(coverage.cells[0].distinctSignedNodes, 2);
  assert.equal(coverage.cells[0].distinctControllerGroups, 2);
  assert.equal(coverage.cells[0].lastObservedDate, "2026-08-15");
  assert.equal(coverage.cells[0].freshness, "fresh");
  assert.doesNotMatch(JSON.stringify(coverage), /8\.8\.8|smoke/);
  assert.equal(coverage.labCells.length, 1);
  assert.equal(coverage.labCells[0].toolVersion, "7.7.7");
  assert.equal(coverage.labCells[0].distinctSignedNodes, 2);
  assert.equal(coverage.labCells[0].distinctParticipants, 2);
  assert.equal(coverage.labCells[0].distinctControllerGroups, 1);
  assert.equal(coverage.labCells[0].evidenceStatus, "first-party-lab-replicated");
  assert.equal(coverage.boundaries.sparseCellsWithheld, true);
  assert.doesNotMatch(JSON.stringify(coverage), /agent-a|agent-b|agent-c|root-a|root-b/);
});
