import assert from "node:assert/strict";
import test from "node:test";
import { spansFromGeminiCliLogs } from "../js/lib/gemini-cli.mjs";
import { adaptOtelSpanToRouteOutcome } from "../js/lib/receipt.mjs";

const adapter = {
  enabled: true,
  clientVersion: "0.3.0",
  environment: "linux-x64",
  tools: {
    run_shell_command: {
      toolRegistry: "github",
      toolId: "io.agentwex/gemini-shell",
      toolVersion: "1.1.0",
      authMode: "none",
      operation: "repository-check",
    },
  },
};

function logPayload({ tool = "run_shell_command", success = true } = {}) {
  return { resourceLogs: [{ resource: { attributes: [{ key: "sessionId", value: { stringValue: "PRIVATE-GEMINI-SESSION" } }] }, scopeLogs: [{ logRecords: [{
    timeUnixNano: "1786870800000000000",
    body: { stringValue: "PRIVATE GEMINI BODY" },
    attributes: [
      { key: "event.name", value: { stringValue: "gemini_cli.tool_call" } },
      { key: "function_name", value: { stringValue: tool } },
      { key: "success", value: { boolValue: success } },
      { key: "function_args", value: { stringValue: "PRIVATE GEMINI ARGUMENTS" } },
      { key: "metadata", value: { stringValue: "PRIVATE GEMINI METADATA" } },
    ],
  }] }] }] };
}

test("Gemini CLI tool calls become minimized canonical receipts", () => {
  const translated = spansFromGeminiCliLogs(logPayload(), adapter);
  assert.deepEqual({ received: translated.received, ignored: translated.ignored, spans: translated.spans.length }, { received: 1, ignored: 0, spans: 1 });
  const result = adaptOtelSpanToRouteOutcome(translated.spans[0], {
    enabled: true, shareToolOutcomes: true, agentId: "agent-gemini-test",
  });
  assert.equal(result.status, "READY_TO_SUBMIT");
  assert.equal(result.receipt.clientId, "gemini-cli");
  assert.equal(result.receipt.outcome, "success");
  const serialized = JSON.stringify(result);
  for (const secret of ["PRIVATE-GEMINI-SESSION", "PRIVATE GEMINI BODY", "PRIVATE GEMINI ARGUMENTS", "PRIVATE GEMINI METADATA"]) {
    assert.doesNotMatch(serialized, new RegExp(secret));
  }
});

test("Gemini CLI adapter fails closed for unmapped or sessionless calls", () => {
  assert.equal(spansFromGeminiCliLogs(logPayload({ tool: "unknown" }), adapter).spans.length, 0);
  const payload = logPayload();
  payload.resourceLogs[0].resource.attributes = [];
  assert.equal(spansFromGeminiCliLogs(payload, adapter).spans.length, 0);
});
