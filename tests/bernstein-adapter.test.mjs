import assert from "node:assert/strict";
import test from "node:test";
import { bernsteinPluginSource, spansFromBernsteinEvents } from "../js/lib/bernstein.mjs";
import { adaptOtelSpanToRouteOutcome } from "../js/lib/receipt.mjs";

const adapter = {
  enabled: true,
  clientVersion: "3.12.0",
  environment: "macos-arm64",
  tools: {
    repository_migration: {
      toolRegistry: "github",
      toolId: "io.agentwex/repository-migration",
      toolVersion: "1.0.0",
      authMode: "none",
      operation: "repository-migration",
      resolutionKind: "none",
    },
  },
};

function payload(event = "task_completed") {
  return {
    schema: "agentwex.bernstein-hook.v0.1",
    events: [{
      event,
      taskId: "private-task-id",
      toolName: "repository_migration",
      observedAt: "2026-08-16T10:00:00.000Z",
      result_summary: "PRIVATE RESULT SUMMARY",
      error: "PRIVATE ERROR",
      prompt: "PRIVATE PROMPT",
    }],
  };
}

test("Bernstein adapter turns explicit lifecycle outcomes into minimized route receipts", () => {
  const translated = spansFromBernsteinEvents(payload(), adapter);
  assert.deepEqual({ received: translated.received, ignored: translated.ignored, spans: translated.spans.length }, { received: 1, ignored: 0, spans: 1 });
  const result = adaptOtelSpanToRouteOutcome(translated.spans[0], { enabled: true, shareToolOutcomes: true, agentId: "agent-1" });
  assert.equal(result.receipt.outcome, "success");
  assert.equal(result.receipt.clientId, "bernstein");
  assert.equal(result.receipt.toolId, "io.agentwex/repository-migration");
  const serialized = JSON.stringify(result);
  for (const secret of ["private-task-id", "PRIVATE RESULT SUMMARY", "PRIVATE ERROR", "PRIVATE PROMPT"]) {
    assert.doesNotMatch(serialized, new RegExp(secret));
  }
});

test("Bernstein adapter fails closed for unmapped, malformed, or non-outcome events", () => {
  assert.equal(spansFromBernsteinEvents(payload("task_created"), adapter).spans.length, 0);
  assert.equal(spansFromBernsteinEvents({ ...payload(), schema: "unknown" }, adapter).spans.length, 0);
  const unmapped = payload();
  unmapped.events[0].toolName = "unknown";
  assert.equal(spansFromBernsteinEvents(unmapped, adapter).spans.length, 0);
  const missingId = payload();
  delete missingId.events[0].taskId;
  assert.equal(spansFromBernsteinEvents(missingId, adapter).spans.length, 0);
});

test("generated Bernstein plugin never reads summaries, errors, prompts, results, diffs, or source", () => {
  const source = bernsteinPluginSource();
  assert.match(source, /on_task_completed/);
  assert.match(source, /on_task_failed/);
  assert.match(source, /agentwex\.bernstein-hook\.v0\.1/);
  assert.match(source, /role != expected_role/);
  assert.doesNotMatch(source, /"role": role/);
  assert.doesNotMatch(source, /json\.dumps\([^)]*result_summary/s);
  assert.doesNotMatch(source, /json\.dumps\([^)]*error/s);
  assert.doesNotMatch(source, /urllib\.request\.urlopen\([^)]*result_summary/s);
});
