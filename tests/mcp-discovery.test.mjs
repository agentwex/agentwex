import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { mappingForTool } from "../js/lib/automatic-mapping.mjs";
import { discoverMcpServers, mcpServerFromToolName, serverFromDeclaration } from "../js/lib/mcp-discovery.mjs";

test("a declared launch command states the version a tool name cannot", () => {
  assert.deepEqual(
    serverFromDeclaration({ command: "npx", args: ["-y", "@modelcontextprotocol/server-github@1.2.3"] }),
    { packageId: "@modelcontextprotocol/server-github", version: "1.2.3", packageRegistry: "npm" },
  );
  assert.deepEqual(
    serverFromDeclaration({ command: "uvx", args: ["mcp-server-git==2.0.1"] }),
    { packageId: "mcp-server-git", version: "2.0.1", packageRegistry: "pypi" },
  );
  assert.equal(serverFromDeclaration({ command: "npx", args: ["-y", "@scope/pkg"] }), null,
    "a package pinned to no version states no version");
  assert.equal(serverFromDeclaration({ command: "node", args: ["./local-server.js"] }), null,
    "an interpreter pointed at a local path states no version");
  assert.equal(serverFromDeclaration(null), null);
});

test("an explicit version overrides anything inferred from a command line", () => {
  const declared = serverFromDeclaration({ command: "npx", args: ["-y", "@scope/pkg@1.0.0"], version: "9.9.9" });
  assert.equal(declared.version, "9.9.9");
});

test("a tool name yields the server that owns it", () => {
  assert.equal(mcpServerFromToolName("mcp__github__search_issues"), "github");
  assert.equal(mcpServerFromToolName("mcp__claude-in-chrome__navigate"), "claude-in-chrome");
  assert.equal(mcpServerFromToolName("mcp__my_server__do"), "my_server", "server names may contain underscores");
  assert.equal(mcpServerFromToolName("mcp.server.tool"), "server");
  assert.equal(mcpServerFromToolName("Bash"), null);
  assert.equal(mcpServerFromToolName(undefined), null);
});

test("discovery reads declarations without executing or fetching anything", async (context) => {
  const home = await mkdtemp(resolve(tmpdir(), "awe-mcp-home-"));
  context.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(resolve(home, ".claude"), { recursive: true });
  await writeFile(resolve(home, ".claude.json"), JSON.stringify({
    mcpServers: { github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github@1.2.3"] } },
    projects: {
      "/some/project": { mcpServers: { git: { command: "uvx", args: ["mcp-server-git==2.0.1"] } } },
    },
  }));
  await writeFile(resolve(home, ".claude", "settings.json"), JSON.stringify({
    mcpServers: { local: { command: "node", args: ["./server.js"] } },
  }));

  const discovered = await discoverMcpServers({ home });
  assert.equal(discovered.github.version, "1.2.3");
  assert.equal(discovered.git.version, "2.0.1", "per-project declarations are read too");
  assert.equal(discovered.local, undefined, "a server with no stated version is omitted, not guessed");
});

test("automatic mapping states a declared version and stays unknown otherwise", () => {
  const adapter = {
    autoMap: true, clientId: "claude-code", clientVersion: "2.1.223",
    mcpServers: { github: { version: "1.2.3", packageId: "@modelcontextprotocol/server-github", packageRegistry: "npm" } },
  };

  const declared = mappingForTool("mcp__github__search_issues", adapter);
  assert.equal(declared.toolRegistry, "mcp");
  assert.equal(declared.toolVersion, "1.2.3");
  assert.equal(declared.versionBasis, "declared-mcp-server");

  const undeclared = mappingForTool("mcp__mystery__do", adapter);
  assert.equal(undeclared.toolVersion, "unknown");
  assert.equal(undeclared.versionBasis, "unknown",
    "an undiscovered server is reported unknown rather than borrowing the client version");

  // A built-in tool ships with its runtime, so the client version is its version.
  const internal = mappingForTool("StructuredOutput", adapter);
  assert.equal(internal.toolVersion, "2.1.223");
  assert.equal(internal.versionBasis, "runtime-client");
});

test("a tool name is transmitted only when its server resolves to a published package", async () => {
  const { spansFromClaudeCodeLogs } = await import("../js/lib/claude-code.mjs");
  const { adaptOtelSpanToRouteOutcome } = await import("../js/lib/receipt.mjs");
  const policy = { enabled: true, shareToolOutcomes: true, agentId: "agent_x" };
  const adapter = {
    enabled: true, autoMap: true, clientId: "claude-code", clientVersion: "2.1.223", environment: "macos-arm64",
    mcpServers: { github: { version: "1.2.3", packageId: "@modelcontextprotocol/server-github", packageRegistry: "npm" } },
  };
  const logs = (tool) => ({ resourceLogs: [{ resource: { attributes: [] }, scopeLogs: [{ logRecords: [{
    timeUnixNano: "1755000000000000000",
    attributes: [
      { key: "event.name", value: { stringValue: "tool_result" } },
      { key: "tool_name", value: { stringValue: tool } },
      { key: "success", value: { boolValue: true } },
      { key: "tool_use_id", value: { stringValue: "u1" } },
    ] }] }] }] });

  const publicSpan = spansFromClaudeCodeLogs(logs("mcp__github__search_issues"), adapter).spans[0];
  const published = adaptOtelSpanToRouteOutcome(publicSpan, policy);
  assert.equal(published.status, "READY_TO_SUBMIT");
  assert.equal(published.receipt.toolId, "mcp__github__search_issues",
    "a public server's tool name is the cell identity and must travel in the clear");

  const privateSpan = spansFromClaudeCodeLogs(logs("mcp__acme_internal__billing_export"), adapter).spans[0];
  const withheld = adaptOtelSpanToRouteOutcome(privateSpan, policy);
  assert.equal(withheld.status, "IGNORED");
  assert.equal(withheld.reason, "private_namespace_never_transmitted");
  assert.equal(withheld.receipt, undefined, "no receipt is built, so the name cannot leak");

  // An operator who maps a tool has declared it shareable, and chooses the id.
  const declared = {
    ...adapter,
    tools: { mcp__acme_internal__billing_export: { toolRegistry: "mcp", toolId: "acme/billing", toolVersion: "4.0", authMode: "none", operation: "export" } },
  };
  const mappedSpan = spansFromClaudeCodeLogs(logs("mcp__acme_internal__billing_export"), declared).spans[0];
  const mapped = adaptOtelSpanToRouteOutcome(mappedSpan, policy);
  assert.equal(mapped.status, "READY_TO_SUBMIT");
  assert.equal(mapped.receipt.toolId, "acme/billing", "the operator's chosen id is used, not the raw internal name");
});
