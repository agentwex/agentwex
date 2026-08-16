import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { spansFromClaudeCodeLogs } from "../js/lib/claude-code.mjs";
import { spansFromCodexLogs } from "../js/lib/codex.mjs";
import { spansFromGeminiCliLogs } from "../js/lib/gemini-cli.mjs";
import { bootstrapDetectedRuntimes, removeAgentWexRuntimeConfig } from "../js/lib/runtime-bootstrap.mjs";

const config = () => ({
  collector: { port: 4318, token: "private-test-token" },
  adapters: {},
});

test("automatic bootstrap safely configures Claude Code, Codex, and Gemini CLI", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "awe-runtime-bootstrap-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const value = config();
  const results = await bootstrapDetectedRuntimes({
    config: value,
    runtimeHome: root,
    backupDir: resolve(root, ".awe", "backups"),
    environment: "macos-arm64",
    detectedRuntimes: [
      { id: "claude-code", detected: true, version: "1.2.3" },
      { id: "codex", detected: true, version: "0.145.0" },
      { id: "gemini-cli", detected: true, version: "0.4.0" },
      { id: "bernstein", detected: true, version: "1.0.0" },
    ],
  });
  assert.deepEqual(results.map(({ runtime, status }) => ({ runtime, status })), [
    { runtime: "claude-code", status: "configured" },
    { runtime: "codex", status: "configured" },
    { runtime: "gemini-cli", status: "configured" },
    { runtime: "bernstein", status: "optional_manual_adapter" },
  ]);
  assert.equal(value.adapters.claudeCode.autoMap, true);
  assert.equal(value.adapters.codex.autoMap, true);
  assert.equal(value.adapters.geminiCli.autoMap, true);

  const claude = JSON.parse(await readFile(resolve(root, ".claude", "settings.json"), "utf8"));
  assert.equal(claude.env.OTEL_LOG_TOOL_DETAILS, undefined);
  assert.equal(claude.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT, "http://127.0.0.1:4318/v1/logs");
  const codex = await readFile(resolve(root, ".codex", "config.toml"), "utf8");
  assert.match(codex, /log_user_prompt = false/);
  assert.match(codex, /private-test-token/);
  const gemini = JSON.parse(await readFile(resolve(root, ".gemini", "settings.json"), "utf8"));
  assert.equal(gemini.telemetry.logPrompts, false);
  assert.equal(gemini.telemetry.traces, false);

  claude.theme = "dark";
  gemini.theme = "light";
  await writeFile(resolve(root, ".claude", "settings.json"), `${JSON.stringify(claude, null, 2)}\n`);
  await writeFile(resolve(root, ".gemini", "settings.json"), `${JSON.stringify(gemini, null, 2)}\n`);
  await writeFile(resolve(root, ".codex", "config.toml"), `approval_policy = "never"\n\n${codex}`);
  const removed = await removeAgentWexRuntimeConfig({ config: value, runtimeHome: root });
  assert.equal(removed.length, 3);
  const cleanClaude = JSON.parse(await readFile(resolve(root, ".claude", "settings.json"), "utf8"));
  const cleanGemini = JSON.parse(await readFile(resolve(root, ".gemini", "settings.json"), "utf8"));
  const cleanCodex = await readFile(resolve(root, ".codex", "config.toml"), "utf8");
  assert.equal(cleanClaude.theme, "dark");
  assert.equal(cleanClaude.env, undefined);
  assert.equal(cleanGemini.theme, "light");
  assert.equal(cleanGemini.telemetry, undefined);
  assert.equal(cleanCodex, 'approval_policy = "never"\n');
});

test("bootstrap refuses to replace a competing telemetry destination", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "awe-runtime-conflict-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const codexDir = resolve(root, ".codex");
  await mkdir(codexDir, { recursive: true });
  await writeFile(resolve(codexDir, "config.toml"), "[otel]\nexporter = \"none\"\n");
  const value = config();
  const [result] = await bootstrapDetectedRuntimes({
    config: value,
    runtimeHome: root,
    backupDir: resolve(root, ".awe", "backups"),
    environment: "linux-x64",
    detectedRuntimes: [{ id: "codex", detected: true, version: "0.145.0" }],
  });
  assert.equal(result.status, "telemetry_conflict");
  assert.equal(value.adapters.codex, undefined);
  assert.equal(await readFile(resolve(codexDir, "config.toml"), "utf8"), "[otel]\nexporter = \"none\"\n");
});

function payload(eventName, toolKey, toolName, identityKey) {
  const resource = eventName === "gemini_cli.tool_call"
    ? { attributes: [{ key: "sessionId", value: { stringValue: "session" } }] }
    : undefined;
  return { resourceLogs: [{ resource, scopeLogs: [{ logRecords: [{
    observedTimeUnixNano: "1786870800000000000",
    timeUnixNano: "1786870800000000000",
    attributes: [
      { key: "event.name", value: { stringValue: eventName } },
      { key: toolKey, value: { stringValue: toolName } },
      { key: identityKey, value: { stringValue: "call" } },
      { key: "success", value: { boolValue: true } },
    ],
  }] }] }] };
}

test("runtime-derived fallback is honest and manual mapping still wins", () => {
  const automatic = { enabled: true, autoMap: true, clientId: "claude-code", clientVersion: "1.2.3", environment: "macos-arm64", tools: {} };
  const claude = spansFromClaudeCodeLogs(payload("tool_result", "tool_name", "Bash", "tool_use_id"), automatic).spans[0];
  assert.equal(claude.attributes["awe.tool.registry"], "runtime");
  assert.equal(claude.attributes["awe.tool.version"], "unknown");
  assert.equal(claude.attributes["awe.auth.mode"], "other");

  const codex = spansFromCodexLogs(payload("codex.tool_result", "tool_name", "exec_command", "call_id"), { ...automatic, clientId: "codex" }).spans[0];
  assert.equal(codex.attributes["gen_ai.tool.name"], "codex/exec_command");
  const gemini = spansFromGeminiCliLogs(payload("gemini_cli.tool_call", "function_name", "run_shell_command", "unused"), { ...automatic, clientId: "gemini-cli" }).spans[0];
  assert.equal(gemini.attributes["gen_ai.tool.name"], "gemini-cli/run_shell_command");

  const manual = { ...automatic, tools: { Bash: { toolRegistry: "github", toolId: "bounded/bash", toolVersion: "2.0.0", authMode: "none", operation: "bounded-run" } } };
  const precise = spansFromClaudeCodeLogs(payload("tool_result", "tool_name", "Bash", "tool_use_id"), manual).spans[0];
  assert.equal(precise.attributes["awe.tool.registry"], "github");
  assert.equal(precise.attributes["awe.tool.version"], "2.0.0");
});
