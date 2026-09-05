import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { normalizeOpenInferenceSpans } from "../js/lib/openinference.mjs";
import { adaptOtelSpanToRouteOutcome } from "../js/lib/receipt.mjs";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../js/bin/agentwex.js", import.meta.url));

const sensitiveSpan = {
  traceId: "private-trace-id",
  spanId: "private-span-id",
  endTime: "2026-09-05T11:20:00.000Z",
  status: { code: "ERROR" },
  resource: { attributes: { "service.name": "private-agent", "host.name": "secret-laptop" } },
  attributes: {
    "openinference.span.kind": "TOOL",
    "tool.name": "search_repositories",
    "tool.id": "private-call-id",
    "tool.description": "internal description",
    "input.value": "{\"repository\":\"private/customer\",\"token\":\"secret\"}",
    "output.value": "customer data",
    metadata: "{\"private\":true}",
    "exception.type": "ConnectionError",
    "exception.message": "secret endpoint failed",
    "exception.stacktrace": "private/source/file.js:42",
  },
};

const adapter = {
  enabled: true,
  clientId: "langgraph",
  clientVersion: "1.2.0",
  environment: "macos-arm64",
  tools: {
    search_repositories: {
      toolRegistry: "mcp",
      toolId: "io.github.example/github-mcp",
      toolVersion: "3.1.0",
      authMode: "oauth-pkce",
      operation: "repository-search",
      capabilityId: "repository.search",
      effectClass: "read",
      resolutionKind: "none",
    },
  },
};

test("OpenInference TOOL spans require an enabled exact operator mapping", () => {
  assert.equal(normalizeOpenInferenceSpans([sensitiveSpan], {}).ignored, 1);
  assert.equal(normalizeOpenInferenceSpans([sensitiveSpan], { ...adapter, enabled: false }).ignored, 1);
  assert.equal(normalizeOpenInferenceSpans([{ ...sensitiveSpan, attributes: { ...sensitiveSpan.attributes, "tool.name": "unmapped_private_tool" } }], adapter).ignored, 1);
});

test("OpenInference normalization copies only bounded compatibility fields", () => {
  const normalized = normalizeOpenInferenceSpans([sensitiveSpan], adapter);
  assert.equal(normalized.received, 1);
  assert.equal(normalized.normalized, 1);
  assert.equal(normalized.ignored, 0);
  const [span] = normalized.spans;
  assert.deepEqual(span.resource.attributes, {});
  assert.deepEqual(Object.keys(span.attributes).sort(), [
    "awe.auth.mode", "awe.capability.id", "awe.client.id", "awe.client.version",
    "awe.effect.class", "awe.environment", "awe.operation", "awe.resolution.kind",
    "awe.tool.registry", "awe.tool.version", "error.type", "gen_ai.operation.name",
    "gen_ai.tool.name",
  ]);

  const result = adaptOtelSpanToRouteOutcome(span, { enabled: true, shareToolOutcomes: true, agentId: "agent-1" });
  assert.equal(result.status, "READY_TO_SUBMIT");
  assert.equal(result.receipt.toolId, "io.github.example/github-mcp");
  assert.equal(result.receipt.clientId, "langgraph");
  assert.equal(result.receipt.errorClass, "network");
  const serialized = JSON.stringify(result);
  for (const forbidden of ["private-agent", "secret-laptop", "private/customer", "secret endpoint", "private/source", "private-span-id", "private-trace-id", "customer data"]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must remain local`);
  }
});

test("non-TOOL OpenInference spans stay local while canonical Agent WEX spans pass through", () => {
  const llm = { ...sensitiveSpan, attributes: { ...sensitiveSpan.attributes, "openinference.span.kind": "LLM" } };
  const canonical = {
    ...sensitiveSpan,
    attributes: {
      "openinference.span.kind": "TOOL",
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.tool.name": "already-canonical",
    },
  };
  const result = normalizeOpenInferenceSpans([llm, canonical], adapter);
  assert.equal(result.received, 2);
  assert.equal(result.ignored, 1);
  assert.equal(result.normalized, 0);
  assert.equal(result.spans[0], canonical);
});

test("the CLI writes an exact OpenInference mapping and private collector environment", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agentwex-openinference-"));
  const configPath = join(directory, "config.json");
  try {
    await writeFile(configPath, `${JSON.stringify({
      schema: "minority-prophet.awe-node-config.v0.1",
      baseUrl: "https://agentwex.xyz",
      apiKey: "test-api-key",
      agentId: "test-agent",
      collector: { host: "127.0.0.1", port: 4318, token: "private-local-token" },
      policy: { shareToolOutcomes: true, shareRawTraces: false },
    })}\n`);
    const { stdout } = await execFileAsync(process.execPath, [
      cli, "adapter", "openinference",
      "--client", "langgraph", "--client-version", "1.2.0",
      "--tool", "search_repositories", "--tool-registry", "mcp",
      "--tool-id", "io.github.example/github-mcp", "--tool-version", "3.1.0",
      "--auth-mode", "oauth-pkce", "--operation", "repository-search",
      "--capability", "repository.search", "--effect", "read",
      "--config", configPath,
    ]);
    const saved = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(saved.adapters.openInference.clientId, "langgraph");
    assert.equal(saved.adapters.openInference.tools.search_repositories.toolId, "io.github.example/github-mcp");
    const environmentPath = join(directory, "openinference-otel.env");
    const environment = await readFile(environmentPath, "utf8");
    assert.match(environment, /OTEL_EXPORTER_OTLP_ENDPOINT/);
    assert.equal((await stat(environmentPath)).mode & 0o777, 0o600);
    assert.equal(stdout.includes("private-local-token"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
