import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { writePrivateText } from "./config.mjs";

const runtimeKeys = {
  "claude-code": "claudeCode",
  codex: "codex",
  "gemini-cli": "geminiCli",
};

const exists = async (path) => {
  try { return await readFile(path, "utf8"); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
};

function sameValue(actual, expected) {
  return String(actual ?? "") === String(expected);
}

async function saveWithBackup(path, content, backupDir) {
  const current = await exists(path);
  if (current === content) return { changed: false, path, backupPath: null };
  let backupPath = null;
  if (current != null) {
    await mkdir(backupDir, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
    backupPath = resolve(backupDir, `${path.split("/").pop()}.${stamp}.before-agent-wex`);
    await writePrivateText(backupPath, current);
  }
  await writePrivateText(path, content);
  return { changed: true, path, backupPath };
}

async function readJsonObject(path) {
  const text = await exists(path);
  if (text == null) return {};
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error(`RUNTIME_CONFIG_INVALID_JSON:${path}`); }
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error(`RUNTIME_CONFIG_NOT_OBJECT:${path}`);
  return value;
}

function conflict(path, key) {
  const error = new Error(`TELEMETRY_CONFLICT:${path}:${key}`);
  error.code = "TELEMETRY_CONFLICT";
  throw error;
}

async function configureClaude({ config, runtimeHome, backupDir }) {
  const path = resolve(runtimeHome, ".claude", "settings.json");
  const settings = await readJsonObject(path);
  const expected = {
    CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    OTEL_LOGS_EXPORTER: "otlp",
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/json",
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `http://127.0.0.1:${config.collector.port}/v1/logs`,
    OTEL_EXPORTER_OTLP_HEADERS: `authorization=Bearer ${config.collector.token}`,
  };
  settings.env ??= {};
  if (!settings.env || Array.isArray(settings.env) || typeof settings.env !== "object") conflict(path, "env");
  for (const [key, value] of Object.entries(expected)) {
    if (settings.env[key] != null && !sameValue(settings.env[key], value)) conflict(path, `env.${key}`);
    settings.env[key] = value;
  }
  // Agent WEX never requires verbose tool payload logging.
  if (settings.env.OTEL_LOG_TOOL_DETAILS === "1") conflict(path, "env.OTEL_LOG_TOOL_DETAILS");
  const result = await saveWithBackup(path, `${JSON.stringify(settings, null, 2)}\n`, backupDir);
  return { ...result, runtime: "claude-code", restartRequired: true };
}

async function configureGemini({ config, runtimeHome, backupDir }) {
  const path = resolve(runtimeHome, ".gemini", "settings.json");
  const settings = await readJsonObject(path);
  const expected = {
    enabled: true,
    target: "local",
    otlpEndpoint: `http://127.0.0.1:${config.collector.port}/gemini/${config.collector.token}`,
    otlpProtocol: "http",
    logPrompts: false,
    traces: false,
  };
  if (settings.telemetry != null && (Array.isArray(settings.telemetry) || typeof settings.telemetry !== "object")) conflict(path, "telemetry");
  settings.telemetry ??= {};
  for (const [key, value] of Object.entries(expected)) {
    if (settings.telemetry[key] != null && !sameValue(settings.telemetry[key], value)) conflict(path, `telemetry.${key}`);
    settings.telemetry[key] = value;
  }
  const result = await saveWithBackup(path, `${JSON.stringify(settings, null, 2)}\n`, backupDir);
  return { ...result, runtime: "gemini-cli", restartRequired: true };
}

function codexOtelBlock(config) {
  return `[otel]\nenvironment = "production"\nlog_user_prompt = false\nexporter = { otlp-http = { endpoint = "http://127.0.0.1:${config.collector.port}/v1/codex/logs", protocol = "json", headers = { authorization = "Bearer ${config.collector.token}" } } }\n`;
}

async function configureCodex({ config, runtimeHome, backupDir }) {
  const path = resolve(runtimeHome, ".codex", "config.toml");
  const current = await exists(path);
  const endpoint = `http://127.0.0.1:${config.collector.port}/v1/codex/logs`;
  let content = current ?? "";
  const otelHeader = /^\s*\[otel\]\s*$/m;
  if (otelHeader.test(content)) {
    if (!content.includes(endpoint) || !content.includes(config.collector.token)) conflict(path, "otel.exporter");
    if (/log_user_prompt\s*=\s*true/.test(content)) conflict(path, "otel.log_user_prompt");
    return { runtime: "codex", changed: false, path, backupPath: null, restartRequired: true };
  }
  content = `${content.trimEnd()}${content.trim().length ? "\n\n" : ""}${codexOtelBlock(config)}`;
  const result = await saveWithBackup(path, content, backupDir);
  return { ...result, runtime: "codex", restartRequired: true };
}

function adapterConfig(runtime, environment) {
  return {
    enabled: true,
    autoMap: true,
    mappingBasis: "runtime-derived",
    clientId: runtime.id,
    clientVersion: runtime.version ?? "detected",
    environment,
    tools: {},
  };
}

export async function bootstrapDetectedRuntimes({ config, detectedRuntimes, environment, runtimeHome = homedir(), backupDir = resolve(dirname(config.configPath ?? resolve(homedir(), ".awe", "config.json")), "backups") }) {
  const results = [];
  config.adapters ??= {};
  for (const runtime of detectedRuntimes.filter((entry) => entry.detected)) {
    if (runtime.id === "bernstein") {
      results.push({ runtime: runtime.id, status: "optional_manual_adapter", reason: "bounded_task_role_required" });
      continue;
    }
    try {
      const context = { config, runtimeHome, backupDir };
      const configured = runtime.id === "claude-code"
        ? await configureClaude(context)
        : runtime.id === "codex"
          ? await configureCodex(context)
          : runtime.id === "gemini-cli"
            ? await configureGemini(context)
            : null;
      if (!configured) {
        results.push({ runtime: runtime.id, status: "unsupported" });
        continue;
      }
      config.adapters[runtimeKeys[runtime.id]] = {
        ...adapterConfig(runtime, environment),
        ...(config.adapters[runtimeKeys[runtime.id]] ?? {}),
        enabled: true,
        autoMap: true,
        clientId: runtime.id,
        clientVersion: runtime.version ?? "detected",
        environment,
        tools: config.adapters[runtimeKeys[runtime.id]]?.tools ?? {},
      };
      results.push({ ...configured, status: "configured" });
    } catch (error) {
      results.push({ runtime: runtime.id, status: error?.code === "TELEMETRY_CONFLICT" ? "telemetry_conflict" : "configuration_failed", error: error.message });
    }
  }
  return results;
}

export async function removeAgentWexRuntimeConfig({ config, runtimeHome = config.runtimeHome ?? homedir() }) {
  const results = [];
  const claudePath = resolve(runtimeHome, ".claude", "settings.json");
  const claudeText = await exists(claudePath);
  if (claudeText != null) {
    const settings = JSON.parse(claudeText);
    const expected = {
      CLAUDE_CODE_ENABLE_TELEMETRY: "1",
      OTEL_LOGS_EXPORTER: "otlp",
      OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/json",
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `http://127.0.0.1:${config.collector.port}/v1/logs`,
      OTEL_EXPORTER_OTLP_HEADERS: `authorization=Bearer ${config.collector.token}`,
    };
    for (const [key, value] of Object.entries(expected)) if (sameValue(settings.env?.[key], value)) delete settings.env[key];
    if (settings.env && Object.keys(settings.env).length === 0) delete settings.env;
    await writePrivateText(claudePath, `${JSON.stringify(settings, null, 2)}\n`);
    results.push({ runtime: "claude-code", path: claudePath, status: "agent_wex_keys_removed" });
  }

  const geminiPath = resolve(runtimeHome, ".gemini", "settings.json");
  const geminiText = await exists(geminiPath);
  if (geminiText != null) {
    const settings = JSON.parse(geminiText);
    const expected = {
      enabled: true,
      target: "local",
      otlpEndpoint: `http://127.0.0.1:${config.collector.port}/gemini/${config.collector.token}`,
      otlpProtocol: "http",
      logPrompts: false,
      traces: false,
    };
    for (const [key, value] of Object.entries(expected)) if (sameValue(settings.telemetry?.[key], value)) delete settings.telemetry[key];
    if (settings.telemetry && Object.keys(settings.telemetry).length === 0) delete settings.telemetry;
    await writePrivateText(geminiPath, `${JSON.stringify(settings, null, 2)}\n`);
    results.push({ runtime: "gemini-cli", path: geminiPath, status: "agent_wex_keys_removed" });
  }

  const codexPath = resolve(runtimeHome, ".codex", "config.toml");
  const codexText = await exists(codexPath);
  if (codexText != null) {
    const exact = codexOtelBlock(config);
    const updated = codexText.replace(`${exact}\n`, "").replace(exact, "").trimEnd();
    if (updated !== codexText.trimEnd()) {
      await writePrivateText(codexPath, updated ? `${updated}\n` : "");
      results.push({ runtime: "codex", path: codexPath, status: "agent_wex_block_removed" });
    }
  }
  return results;
}
