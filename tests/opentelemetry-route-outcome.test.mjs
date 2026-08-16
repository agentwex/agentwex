import assert from "node:assert/strict";
import test from "node:test";
import { adaptOtelSpanToRouteOutcome } from "../exchange/knowledge-exchange-v0.1/adapters/opentelemetry-route-outcome.mjs";

const span = {
  traceId: "trace-7a",
  spanId: "span-9f",
  endTime: "2026-08-15T19:15:00.000Z",
  status: { code: "ERROR" },
  resource: { attributes: { "service.name": "private-migration-agent", "service.instance.id": "host-secret-17" } },
  attributes: {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.name": "io.github.example/github-mcp",
    "gen_ai.tool.call.arguments": { repository: "secret/customer-repo", token: "secret-token" },
    "gen_ai.tool.call.result": { privateOutput: "customer data" },
    "gen_ai.input.messages": [{ role: "user", content: "private prompt" }],
    "awe.tool.registry": "mcp",
    "awe.tool.version": "3.1.0",
    "awe.client.id": "claude-code",
    "awe.client.version": "1.7.0",
    "awe.environment": "macos-arm64",
    "awe.auth.mode": "oauth-pkce",
    "awe.operation": "repository-search",
    "awe.resolution.kind": "none",
    "error.type": "oauth-callback-mismatch",
  },
};

const policy = { enabled: true, shareToolOutcomes: true, agentId: "agent-scout-17" };

test("OpenTelemetry adapter requires an explicit operator sharing policy", () => {
  assert.equal(adaptOtelSpanToRouteOutcome(span, { ...policy, enabled: false }).reason, "operator_policy_disabled");
});

test("OpenTelemetry adapter ignores spans that are not completed tool executions", () => {
  const result = adaptOtelSpanToRouteOutcome({ ...span, attributes: { "gen_ai.operation.name": "chat" } }, policy);
  assert.equal(result.reason, "not_an_execute_tool_span");
});

test("OpenTelemetry adapter emits only the minimized AWE outcome receipt", () => {
  const result = adaptOtelSpanToRouteOutcome(span, policy);
  assert.equal(result.status, "READY_TO_SUBMIT");
  assert.equal(result.receipt.outcome, "failure");
  assert.equal(result.receipt.errorClass, "oauth-callback-mismatch");
  assert.equal(result.receipt.independenceBasis, "declared");
  assert.equal(result.review.acceptanceStatus, "pending");
  assert.equal(result.authorityGranted, false);
  assert.equal(Buffer.byteLength(JSON.stringify(result.receipt)), 609);
  const serialized = JSON.stringify(result);
  for (const forbidden of ["secret/customer-repo", "secret-token", "customer data", "private prompt", "host-secret-17", "span-9f", "trace-7a"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("retries in one trace collapse to one declared provenance root", () => {
  const first = adaptOtelSpanToRouteOutcome(span, policy);
  const retry = adaptOtelSpanToRouteOutcome({ ...span, spanId: "span-retry" }, policy);
  const independent = adaptOtelSpanToRouteOutcome({ ...span, traceId: "trace-independent" }, policy);
  assert.equal(first.receipt.provenanceRootId, retry.receipt.provenanceRootId);
  assert.notEqual(first.receipt.provenanceRootId, independent.receipt.provenanceRootId);
});

test("successful tool spans become pending success receipts without inventing authority", () => {
  const result = adaptOtelSpanToRouteOutcome({ ...span, status: { code: "OK" } }, policy);
  assert.equal(result.receipt.outcome, "success");
  assert.equal(result.receipt.errorClass, null);
  assert.equal(result.authorityGranted, false);
});
