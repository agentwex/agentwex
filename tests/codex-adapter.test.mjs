import assert from "node:assert/strict";
import test from "node:test";
import { spansFromCodexLogs } from "../js/lib/codex.mjs";
import { adaptOtelSpanToRouteOutcome } from "../js/lib/receipt.mjs";

const adapter = {
  enabled: true,
  clientVersion: "0.145.0",
  environment: "macos-arm64",
  tools: {
    exec_command: {
      toolRegistry: "github",
      toolId: "io.agentwex/codex-exec",
      toolVersion: "1.0.0",
      authMode: "none",
      operation: "repository-check",
    },
  },
};

function logPayload({ tool = "exec_command", success = "false" } = {}) {
  return { resourceLogs: [{ scopeLogs: [{ logRecords: [{
    timeUnixNano: "0",
    observedTimeUnixNano: "1786870800000000000",
    body: { stringValue: "PRIVATE CODEX BODY" },
    attributes: [
      { key: "event.name", value: { stringValue: "codex.tool_result" } },
      { key: "tool_name", value: { stringValue: tool } },
      { key: "call_id", value: { stringValue: "PRIVATE-CODEX-CALL-ID" } },
      { key: "success", value: { stringValue: success } },
      { key: "arguments", value: { stringValue: "PRIVATE CODEX ARGUMENTS" } },
      { key: "output", value: { stringValue: "PRIVATE CODEX OUTPUT" } },
    ],
  }] }] }] };
}

test("Codex tool results become minimized canonical receipts", () => {
  const translated = spansFromCodexLogs(logPayload(), adapter);
  assert.deepEqual({ received: translated.received, ignored: translated.ignored, spans: translated.spans.length }, { received: 1, ignored: 0, spans: 1 });
  const result = adaptOtelSpanToRouteOutcome(translated.spans[0], {
    enabled: true, shareToolOutcomes: true, agentId: "agent-codex-test",
  });
  assert.equal(result.status, "READY_TO_SUBMIT");
  assert.equal(result.receipt.clientId, "codex");
  assert.equal(result.receipt.outcome, "failure");
  assert.equal(result.receipt.observedAt, "2026-08-16T09:00:00.000Z");
  const serialized = JSON.stringify(result);
  for (const secret of ["PRIVATE-CODEX-CALL-ID", "PRIVATE CODEX BODY", "PRIVATE CODEX ARGUMENTS", "PRIVATE CODEX OUTPUT"]) {
    assert.doesNotMatch(serialized, new RegExp(secret));
  }
});

test("Codex adapter fails closed for unmapped or uncorrelated tool results", () => {
  assert.equal(spansFromCodexLogs(logPayload({ tool: "unknown" }), adapter).spans.length, 0);
  const payload = logPayload();
  payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes = payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes.filter((entry) => entry.key !== "call_id");
  assert.equal(spansFromCodexLogs(payload, adapter).spans.length, 0);
});
