import assert from "node:assert/strict";
import test from "node:test";
import { spansFromClaudeCodeLogs } from "../js/lib/claude-code.mjs";
import { adaptOtelSpanToRouteOutcome } from "../js/lib/receipt.mjs";

const adapter = {
  enabled: true,
  clientVersion: "1.0.77",
  environment: "macos-arm64",
  tools: {
    mcp__github__search_repositories: {
      toolRegistry: "mcp",
      toolId: "io.github.example/github-mcp",
      toolVersion: "3.2.0",
      authMode: "oauth-pkce",
      operation: "repository-search",
      capabilityId: "repository.search",
      effectClass: "read",
      resolutionKind: "upgrade-client-and-tool",
    },
  },
};

function logPayload({ tool = "mcp__github__search_repositories", success = "false" } = {}) {
  return {
    resourceLogs: [{
      resource: { attributes: [{ key: "service.name", value: { stringValue: "claude-code" } }] },
      scopeLogs: [{
        logRecords: [{
          timeUnixNano: "1786870800000000000",
          body: { stringValue: "PRIVATE TOOL RESULT BODY" },
          attributes: [
            { key: "event.name", value: { stringValue: "tool_result" } },
            { key: "tool_name", value: { stringValue: tool } },
            { key: "tool_use_id", value: { stringValue: "PRIVATE-CLAUDE-TOOL-USE-ID" } },
            { key: "success", value: { stringValue: success } },
            { key: "error_type", value: { stringValue: "oauth-callback-mismatch" } },
            { key: "tool_parameters", value: { stringValue: "PRIVATE TOOL PARAMETERS" } },
            { key: "tool_result", value: { stringValue: "PRIVATE TOOL OUTPUT" } },
          ],
        }],
      }],
    }],
  };
}

test("Claude Code tool_result logs translate into the canonical minimized receipt", () => {
  const translated = spansFromClaudeCodeLogs(logPayload(), adapter);
  assert.deepEqual({ received: translated.received, ignored: translated.ignored, spans: translated.spans.length }, { received: 1, ignored: 0, spans: 1 });
  const result = adaptOtelSpanToRouteOutcome(translated.spans[0], {
    enabled: true,
    shareToolOutcomes: true,
    agentId: "agent-claude-test",
  });
  assert.equal(result.status, "READY_TO_SUBMIT");
  assert.equal(result.receipt.clientId, "claude-code");
  assert.equal(result.receipt.outcome, "failure");
  assert.equal(result.receipt.toolVersion, "3.2.0");
  assert.equal(result.receipt.capabilityId, "repository.search");
  assert.equal(result.receipt.effectClass, "read");
  const serialized = JSON.stringify(result);
  for (const secret of ["PRIVATE-CLAUDE-TOOL-USE-ID", "PRIVATE TOOL RESULT BODY", "PRIVATE TOOL PARAMETERS", "PRIVATE TOOL OUTPUT"]) {
    assert.doesNotMatch(serialized, new RegExp(secret));
  }
});

test("Claude Code adapter fails closed for unmapped tools", () => {
  const translated = spansFromClaudeCodeLogs(logPayload({ tool: "Bash" }), adapter);
  assert.deepEqual({ received: translated.received, ignored: translated.ignored, spans: translated.spans.length }, { received: 1, ignored: 1, spans: 0 });
});

test("Claude Code adapter does not invent an outcome when success is absent", () => {
  const payload = logPayload();
  payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes = payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes.filter((entry) => entry.key !== "success");
  const translated = spansFromClaudeCodeLogs(payload, adapter);
  assert.equal(translated.ignored, 1);
  assert.equal(translated.spans.length, 0);
});
