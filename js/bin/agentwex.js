#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, rm } from "node:fs/promises";
import { arch, platform } from "node:os";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { deactivateAccount, signup, getAccount, getContribution, getLedger, getReliabilityAlerts, listContributions, preflight, registerSigningKey, revokeSigningKey, rotateApiKey, submitFeedback } from "../lib/client.mjs";
import { defaultConfigPath, readConfig, validateBaseUrl, writePrivateJson, writePrivateText } from "../lib/config.mjs";
import { runDaemon } from "../lib/daemon.mjs";
import { installBackgroundService, uninstallBackgroundService } from "../lib/service.mjs";
import { bernsteinPluginSource } from "../lib/bernstein.mjs";
import { detectRuntimes } from "../lib/runtime-detection.mjs";
import { bootstrapDetectedRuntimes, removeAgentWexRuntimeConfig } from "../lib/runtime-bootstrap.mjs";
import { discoverMcpServers } from "../lib/mcp-discovery.mjs";
import { generateSigningIdentity, publicSigningIdentity } from "../lib/attestation.mjs";
import { buildPrivacyInspection } from "../lib/inspect.mjs";

const ownPath = fileURLToPath(import.meta.url);
const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};
  const positional = [];
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) { positional.push(value); continue; }
    const [rawKey, inline] = value.slice(2).split("=", 2);
    if (["no-service", "yes", "keep-account", "keep-local", "unlock"].includes(rawKey)) options[rawKey] = true;
    else options[rawKey] = inline ?? rest[++index];
  }
  return { command, options, positional };
}

function printHelp() {
  process.stdout.write(`Agent WEX node v0.6.1\n\nCommands:\n  install [--url URL] [--port 4318] [--no-service]\n  uninstall --yes [--keep-account] [--keep-local] [--config PATH]\n  rotate-keys [--config PATH]\n  runtimes [--config PATH]\n  adapter claude-code --tool TOOL --tool-registry REGISTRY --tool-version VERSION --auth-mode MODE [--operation NAME] [--capability ID --effect CLASS]\n  adapter codex --tool TOOL --tool-registry REGISTRY --tool-version VERSION --auth-mode MODE [--operation NAME] [--capability ID --effect CLASS]\n  adapter gemini-cli --tool TOOL --tool-registry REGISTRY --tool-version VERSION --auth-mode MODE [--operation NAME] [--capability ID --effect CLASS]\n  adapter bernstein --task-role ROLE --tool TOOL --tool-registry REGISTRY --tool-version VERSION --auth-mode MODE [--operation NAME] [--capability ID --effect CLASS]\n  daemon [--config PATH]\n  status [--config PATH]\n  credits [--config PATH]\n  ledger [--config PATH]\n  contributions [--limit 25] [--offset 0] [--config PATH]\n  contribution ID [--config PATH]\n  preflight --tool TOOL --tool-registry REGISTRY --tool-version VERSION --client CLIENT --client-version VERSION --environment ENV --auth-mode MODE --operation NAME [--max-age-days 7] [--minimum-independent-roots 2] [--unlock]\n  alerts [--limit 50] [--config PATH]\n  feedback --result RESULT --outcome succeeded|failed|not-attempted [--failure-class authentication|compatibility|timeout|rate-limit|network|unavailable|policy|other] [--attempts-avoided N] [--estimated-tokens-avoided N] [--estimated-latency-ms-avoided N]\n  routes [--config PATH]\n  inspect [--config PATH]\n  doctor [--config PATH]\n\nUse --capability and --effect together to let Navigator compare evidence-backed alternatives across tools without confusing a read route with a write or execution route. Similarity alone never counts as support.\n\nInstall is idempotent. It creates a pseudonymous signing identity, detects and safely connects supported runtimes, starts the local node, and verifies readiness. Run inspect before or after installation to see the exact outbound schema without contacting the exchange. Accepted contributions earn route-access credits automatically; there is no Agent WEX fee or purchase path. A signed node is not proof of an independently controlled operator or genuine execution.\n`);
}

function environmentClass() {
  const key = `${platform()}-${arch()}`;
  return ({ "darwin-arm64": "macos-arm64", "darwin-x64": "macos-x64", "linux-arm64": "linux-arm64", "linux-x64": "linux-x64", "win32-x64": "windows-x64" })[key] ?? "other";
}

async function detectedClaudeVersion(explicit) {
  if (explicit) return explicit;
  try {
    const { stdout } = await execFileAsync("claude", ["--version"], { timeout: 2_000 });
    const match = stdout.match(/\d+(?:\.\d+){1,3}/);
    if (match) return match[0];
  } catch {}
  throw new Error("Claude Code version was not detectable; pass --client-version explicitly");
}

async function detectedRuntimeVersion(command, explicit, displayName) {
  if (explicit) return explicit;
  try {
    const { stdout } = await execFileAsync(command, ["--version"], { timeout: 2_000 });
    const match = stdout.match(/\d+(?:\.\d+){1,3}/);
    if (match) return match[0];
  } catch {}
  throw new Error(`${displayName} version was not detectable; pass --client-version explicitly`);
}

function requiredToolOptions(options, displayName) {
  for (const required of ["tool", "tool-registry", "tool-version", "auth-mode"]) {
    if (!options[required]) throw new Error(`${displayName} adapter requires --${required}`);
  }
}

function bindTool(config, adapterKey, clientVersion, options) {
  const tool = options.tool;
  if ((options.capability == null) !== (options.effect == null)) {
    throw new Error("--capability and --effect must be supplied together");
  }
  if (options.effect && !["read", "write", "execute", "communicate", "observe", "other"].includes(options.effect)) {
    throw new Error("--effect must be read, write, execute, communicate, observe, or other");
  }
  config.adapters ??= {};
  config.adapters[adapterKey] ??= { enabled: true, clientVersion, environment: environmentClass(), tools: {} };
  const adapter = config.adapters[adapterKey];
  adapter.enabled = true;
  adapter.clientVersion = clientVersion;
  adapter.environment = options.environment ?? adapter.environment ?? environmentClass();
  adapter.tools ??= {};
  adapter.tools[tool] = {
    toolRegistry: options["tool-registry"],
    toolId: options["tool-id"] ?? tool,
    toolVersion: options["tool-version"],
    authMode: options["auth-mode"],
    operation: options.operation ?? tool,
    ...(options.capability ? { capabilityId: options.capability, effectClass: options.effect } : {}),
    resolutionKind: options.resolution ?? "none",
  };
}

async function configureClaudeCode(configPath, options) {
  const tool = options.tool;
  requiredToolOptions(options, "Claude Code");
  const config = await readConfig(configPath);
  const clientVersion = await detectedClaudeVersion(options["client-version"]);
  bindTool(config, "claudeCode", clientVersion, options);
  await writePrivateJson(configPath, config);
  const environmentPath = resolve(configPath, "..", "claude-code.env");
  await writePrivateText(environmentPath,
    `export CLAUDE_CODE_ENABLE_TELEMETRY='1'\nexport OTEL_LOGS_EXPORTER='otlp'\nexport OTEL_EXPORTER_OTLP_LOGS_PROTOCOL='http/json'\nexport OTEL_EXPORTER_OTLP_LOGS_ENDPOINT='http://127.0.0.1:${config.collector.port}/v1/logs'\nexport OTEL_EXPORTER_OTLP_HEADERS='authorization=Bearer ${config.collector.token}'\n`);
  process.stdout.write(`Claude Code adapter configured for ${tool}.\nNo prompts, tool parameters, tool inputs, or tool results are requested.\nStart Claude Code with:\n  source ${environmentPath} && claude\n`);
}

async function configureCodex(configPath, options) {
  requiredToolOptions(options, "Codex");
  const config = await readConfig(configPath);
  const clientVersion = await detectedRuntimeVersion("codex", options["client-version"], "Codex");
  bindTool(config, "codex", clientVersion, options);
  await writePrivateJson(configPath, config);
  const fragmentPath = resolve(configPath, "..", "codex-otel.toml");
  await writePrivateText(fragmentPath,
    `[otel]\nenvironment = "dev"\nlog_user_prompt = false\nexporter = { otlp-http = { endpoint = "http://127.0.0.1:${config.collector.port}/v1/codex/logs", protocol = "json", headers = { authorization = "Bearer ${config.collector.token}" } } }\n`);
  process.stdout.write(`Codex adapter configured for ${options.tool}.\nA private user-level OTEL fragment was written to ${fragmentPath}.\nMerge it into ~/.codex/config.toml without replacing an existing exporter; use collector fan-out when one already exists.\nAgent WEX discards Codex arguments and output locally and never submits them.\n`);
}

async function configureGeminiCli(configPath, options) {
  requiredToolOptions(options, "Gemini CLI");
  const config = await readConfig(configPath);
  const clientVersion = await detectedRuntimeVersion("gemini", options["client-version"], "Gemini CLI");
  bindTool(config, "geminiCli", clientVersion, options);
  await writePrivateJson(configPath, config);
  const environmentPath = resolve(configPath, "..", "gemini-cli.env");
  await writePrivateText(environmentPath,
    `export GEMINI_TELEMETRY_ENABLED='1'\nexport GEMINI_TELEMETRY_TARGET='local'\nexport GEMINI_TELEMETRY_OTLP_PROTOCOL='http'\nexport GEMINI_TELEMETRY_OTLP_ENDPOINT='http://127.0.0.1:${config.collector.port}/gemini/${config.collector.token}'\nexport GEMINI_TELEMETRY_LOG_PROMPTS='0'\nexport GEMINI_TELEMETRY_TRACES_ENABLED='0'\n`);
  process.stdout.write(`Gemini CLI adapter configured for ${options.tool}.\nPrompts and detailed traces are disabled.\nStart Gemini CLI with:\n  source ${environmentPath} && gemini\n`);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

async function configureBernstein(configPath, options) {
  requiredToolOptions(options, "Bernstein");
  if (!options["task-role"]) throw new Error("Bernstein adapter requires --task-role so unrelated tasks are not collapsed into one route");
  const config = await readConfig(configPath);
  const clientVersion = await detectedRuntimeVersion("bernstein", options["client-version"], "Bernstein");
  bindTool(config, "bernstein", clientVersion, options);
  await writePrivateJson(configPath, config);
  const directory = resolve(configPath, "..");
  const pluginPath = resolve(directory, "awe_bernstein_plugin.py");
  const environmentPath = resolve(directory, "bernstein.env");
  const snippetPath = resolve(directory, "bernstein-plugin.yaml");
  await writePrivateText(pluginPath, bernsteinPluginSource());
  await writePrivateText(environmentPath,
    `export PYTHONPATH=${shellQuote(directory)}\${PYTHONPATH:+:\$PYTHONPATH}\nexport AGENT_WEX_BERNSTEIN_ENDPOINT='http://127.0.0.1:${config.collector.port}/v1/bernstein/events'\nexport AGENT_WEX_BERNSTEIN_TOKEN='${config.collector.token}'\nexport AGENT_WEX_BERNSTEIN_TOOL=${shellQuote(options.tool)}\nexport AGENT_WEX_BERNSTEIN_ROLE=${shellQuote(options["task-role"])}\n`);
  await writePrivateText(snippetPath, "plugins:\n  - awe_bernstein_plugin:AgentWexPlugin\n");
  process.stdout.write(`Bernstein adapter configured for ${options.tool}.\nThe plugin sends only task id, explicit completed/failed outcome, mapped route name, and time to the loopback Agent WEX node.\nIt ignores task titles, summaries, errors, prompts, results, diffs, and source code.\nAdd the plugin entry from ${snippetPath} to the project's bernstein.yaml, then run:\n  source ${environmentPath} && bernstein <your normal command>\n`);
}

async function runtimes(configPath) {
  let config = null;
  try { config = await readConfig(configPath); } catch {}
  const detected = await detectRuntimes();
  const configured = new Set(Object.entries(config?.adapters ?? {}).filter(([, value]) => value?.enabled === true).map(([key]) => key));
  const adapterKeys = { bernstein: "bernstein", "claude-code": "claudeCode", codex: "codex", "gemini-cli": "geminiCli" };
  process.stdout.write(`${JSON.stringify({
    runtimes: detected.map((runtime) => ({
      id: runtime.id,
      detected: runtime.detected,
      version: runtime.version ?? null,
      adapterConfigured: configured.has(adapterKeys[runtime.id]),
      status: configured.has(adapterKeys[runtime.id]) ? "ready_to_observe_on_next_launch" : runtime.status,
    })),
    genericOtlpHttpJson: { supported: true, endpoint: config ? `http://${config.collector.host}:${config.collector.port}/v1/traces` : null },
    noRuntimeBehavior: "registered_but_safely_idle",
  }, null, 2)}\n`);
}

async function localJson(config, path) {
  const response = await fetch(`http://${config.collector.host}:${config.collector.port}${path}`, {
    headers: { authorization: `Bearer ${config.collector.token}` },
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) throw new Error(`Local Agent WEX node returned ${response.status}`);
  return response.json();
}

async function install(options) {
  const configPath = resolve(options.config ?? defaultConfigPath());
  let config = null;
  let account = null;
  let existingIdentity = false;
  try {
    await access(configPath);
    config = await readConfig(configPath);
    account = await getAccount(config);
    existingIdentity = true;
  } catch (error) {
    if (error?.code !== "ENOENT" && !String(error?.message ?? "").includes("no such file")) throw error;
  }
  const baseUrl = validateBaseUrl(options.url ?? config?.baseUrl ?? process.env.AWE_EXCHANGE_URL ?? "https://agentwex.xyz");
  const port = Number(options.port ?? config?.collector?.port ?? 4318);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Collector port must be an integer from 1024 to 65535");
  const signing = config?.signing ?? generateSigningIdentity();
  if (!config) {
    const displayName = `Agent WEX node ${randomUUID().slice(0, 8)}`;
    const collectorToken = `awelocal_${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
    account = await signup(baseUrl, {
      agent: { name: displayName, identityProvider: "custom", externalSubject: randomUUID(), signingKey: publicSigningIdentity(signing) },
      participation: { heartbeatMinutes: 15, deliveryChannel: "nexus-api", dailyCreditSpendLimit: 10 },
    });
    config = {
      schema: "minority-prophet.awe-node-config.v0.1",
      baseUrl,
      agentId: account.agentId,
      apiKey: account.apiKey,
      signing,
      policy: { shareToolOutcomes: true, shareRawTraces: false, sharePrompts: false, shareToolArguments: false, shareToolResults: false },
      collector: { host: "127.0.0.1", port, token: collectorToken },
      pollSeconds: 60,
      createdAt: new Date().toISOString(),
    };
  } else if (!config.signing) {
    config.signing = signing;
    await registerSigningKey(config, publicSigningIdentity(signing));
  }
  const detected = await detectRuntimes();
  const detectedRuntimes = detected.filter((runtime) => runtime.detected).map(({ id, version }) => ({ id, version }));
  config.runtimeDetection = { detected: detectedRuntimes, scannedAt: new Date().toISOString() };
  // Declared MCP servers carry the version a tool name cannot. Parsed from
  // config files only: nothing is executed and no network call is made.
  const mcpServers = await discoverMcpServers({ projectDir: process.cwd() });
  config.configPath = configPath;
  const runtimeHome = options["runtime-home"] ? resolve(options["runtime-home"]) : config.runtimeHome;
  const runtimeBootstrap = options["no-service"] && !options["runtime-home"]
    ? []
    : await bootstrapDetectedRuntimes({
      config,
      detectedRuntimes: detected,
      environment: environmentClass(),
      runtimeHome,
      backupDir: resolve(configPath, "..", "backups"),
    });
  config.runtimeHome = runtimeHome;
  config.runtimeBootstrap = runtimeBootstrap;
  // Attach the declared servers to every adapter that maps MCP tool names, so
  // automatic mapping can state a version instead of recording "unknown".
  // Re-running install refreshes this the same way it refreshes detection.
  config.mcpServerDiscovery = { servers: mcpServers, scannedAt: new Date().toISOString() };
  for (const adapter of Object.values(config.adapters ?? {})) {
    if (adapter && typeof adapter === "object") adapter.mcpServers = mcpServers;
  }
  delete config.configPath;
  await writePrivateJson(configPath, config);
  const environmentPath = resolve(configPath, "..", "otel.env");
  await writePrivateText(environmentPath,
    `export OTEL_EXPORTER_OTLP_ENDPOINT='http://127.0.0.1:${port}'\nexport OTEL_EXPORTER_OTLP_PROTOCOL='http/json'\nexport OTEL_EXPORTER_OTLP_HEADERS='authorization=Bearer ${config.collector.token}'\n`);
  let service = null;
  if (!options["no-service"]) service = await installBackgroundService({ binPath: ownPath, configPath });
  let backgroundReady = false;
  if (service) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try { await localJson(config, "/health"); backgroundReady = true; break; }
      catch { await new Promise((resolveWait) => setTimeout(resolveWait, 100)); }
    }
  }
  account = await getAccount(config);
  const readyRuntimes = runtimeBootstrap.filter((entry) => entry.status === "configured");
  const conflicts = runtimeBootstrap.filter((entry) => ["telemetry_conflict", "configuration_failed"].includes(entry.status));
  const installStatus = options["no-service"]
    ? "CONFIGURED_NO_SERVICE"
    : conflicts.length > 0
      ? "TELEMETRY_CONFLICT"
      : readyRuntimes.length === 0
        ? "RUNTIME_ADAPTER_REQUIRED"
        : backgroundReady
          ? "INSTALLED_RESTART_REQUIRED"
          : "BACKGROUND_SERVICE_UNAVAILABLE";
  const accountAgentId = account.agentId ?? account.id ?? config.agentId;
  process.stdout.write(`Agent WEX node ${existingIdentity ? "rechecked" : "installed"}.\nIdentity: ${accountAgentId}\nCollector: http://127.0.0.1:${port}/v1/traces\nCredits: ${account.creditBalance}\nAccepted contributions earn credits automatically; route access costs credits, never money.\nRaw prompts, arguments, results, credentials, URLs, and trace IDs are not submitted.\n`);
  if (service) process.stdout.write(`Background service: ${service.label}\n`);
  else process.stdout.write(`Start locally: agentwex daemon --config ${configPath}\n`);
  process.stdout.write(`Connect an OTLP/HTTP JSON runtime without exposing the local token:\n  source ${environmentPath}\n`);
  if (detectedRuntimes.length > 0) {
    process.stdout.write(`Detected runtimes: ${detectedRuntimes.map((runtime) => `${runtime.id} ${runtime.version}`).join(", ")}\n`);
    for (const result of runtimeBootstrap) process.stdout.write(`Runtime ${result.runtime}: ${result.status}\n`);
  } else {
    process.stdout.write("No compatible runtime was detected. The node is registered but safely idle until a runtime adapter or generic OTLP source is connected.\n");
  }
  process.stdout.write(`STATUS: ${installStatus}\n`);
  if (installStatus === "INSTALLED_RESTART_REQUIRED") process.stdout.write("Installation is complete. Launch a new configured runtime session; completed tool outcomes then flow automatically.\n");
  if (!options["no-service"] && !["INSTALLED_RESTART_REQUIRED", "READY_PASSIVE"].includes(installStatus)) process.exitCode = 2;
}

async function rotateKeys(configPath) {
  const config = await readConfig(configPath);
  const previousKeyId = config.signing?.keyId;
  const signing = generateSigningIdentity();
  await registerSigningKey(config, publicSigningIdentity(signing));
  const rotated = await rotateApiKey(config);
  config.apiKey = rotated.apiKey;
  config.signing = signing;
  await writePrivateJson(configPath, config);
  if (previousKeyId) await revokeSigningKey(config, previousKeyId);
  process.stdout.write(`Agent WEX API and signing keys rotated. New credentials were written privately to ${configPath}.\n`);
}

async function uninstall(configPath, options) {
  if (!options.yes) throw new Error("Uninstall requires --yes because it deactivates the remote pseudonymous account by default");
  const config = await readConfig(configPath);
  const service = await uninstallBackgroundService();
  const runtimes = await removeAgentWexRuntimeConfig({ config });
  let remote = { kept: true };
  if (!options["keep-account"]) remote = await deactivateAccount(config);
  if (!options["keep-local"]) await rm(configPath, { force: true });
  process.stdout.write(`${JSON.stringify({ uninstalled: true, remote, service, runtimes, localConfigKept: Boolean(options["keep-local"]), backupsRetained: true }, null, 2)}\n`);
}

/**
 * Runtime detection runs at install time and is never repeated: the background
 * node has no detection code path at all. A runtime installed after the node
 * therefore stays invisible indefinitely, and nothing says so — the node reports
 * healthy while silently observing nothing from it.
 *
 * This re-runs detection on demand (status is already a user-initiated command)
 * and reports any runtime that is present but unconfigured, so the gap is
 * visible without the operator having to suspect it.
 */
async function unconfiguredRuntimes(config) {
  const adapterKeys = { bernstein: "bernstein", "claude-code": "claudeCode", codex: "codex", "gemini-cli": "geminiCli" };
  try {
    const detected = await detectRuntimes();
    return detected
      .filter((runtime) => runtime.detected && config.adapters?.[adapterKeys[runtime.id]]?.enabled !== true)
      .map((runtime) => ({ id: runtime.id, version: runtime.version, resolvedFrom: runtime.resolvedFrom ?? "path" }));
  } catch {
    return [];
  }
}

async function status(configPath) {
  const config = await readConfig(configPath);
  let local = null;
  try { local = await localJson(config, "/awe/status"); } catch {}
  const account = await getAccount(config);
  const unconfigured = await unconfiguredRuntimes(config);
  process.stdout.write(`${JSON.stringify({
    agentId: config.agentId,
    backgroundNode: local ? "running" : "not_reachable",
    readiness: local?.lastRuntimeOutcomeAt
      ? "READY_PASSIVE"
      : local
        ? "INSTALLED_RESTART_REQUIRED"
        : "BACKGROUND_SERVICE_UNAVAILABLE",
    lastRuntimeOutcomeAt: local?.lastRuntimeOutcomeAt ?? null,
    lastRuntimeSource: local?.lastRuntimeSource ?? null,
    creditBalance: account.creditBalance,
    pendingContributions: local?.pendingContributions?.length ?? null,
    openQueries: local?.queries?.filter((entry) => !entry.unlockedAt).length ?? null,
    availableRoutes: local?.routes?.length ?? null,
    observedEvents: local?.observation?.received ?? null,
    contributedEvents: local?.observation?.contributed ?? null,
    ignoredEvents: local?.observation?.ignored ?? null,
    lastObservedAt: local?.observation?.lastObservedAt ?? null,
    unconfiguredRuntimes: unconfigured,
    runtimeDetectionScannedAt: config.runtimeDetection?.scannedAt ?? null,
    authorityGranted: false,
  }, null, 2)}\n`);
  const observation = local?.observation;
  if (observation && observation.received > 0 && observation.contributed === 0) {
    process.stderr.write(
      `Observed ${observation.received} tool outcome(s) and contributed none. ` +
      `Runtime-internal tools are never contributed; map an externally routable tool with 'agentwex adapter <runtime> --tool ...'.\n`,
    );
  }
  if (unconfigured.length > 0) {
    const names = unconfigured.map((entry) => `${entry.id} ${entry.version}`).join(", ");
    process.stderr.write(`Detected but not observed: ${names}. Run 'agentwex install' to wire them.\n`);
  }
}

async function routes(configPath) {
  const config = await readConfig(configPath);
  const result = await localJson(config, "/awe/routes");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function ledger(configPath) {
  const config = await readConfig(configPath);
  process.stdout.write(`${JSON.stringify(await getLedger(config), null, 2)}\n`);
}

async function contributions(configPath, options) {
  const config = await readConfig(configPath);
  process.stdout.write(`${JSON.stringify(await listContributions(config, {
    limit: options.limit ?? 25,
    offset: options.offset ?? 0,
  }), null, 2)}\n`);
}

async function contribution(configPath, contributionId) {
  if (!contributionId) throw new Error("Contribution ID is required: agentwex contribution <id>");
  const config = await readConfig(configPath);
  process.stdout.write(`${JSON.stringify(await getContribution(config, contributionId), null, 2)}\n`);
}

function requiredPreflightOptions(options) {
  for (const required of ["tool", "tool-registry", "tool-version", "client", "client-version", "environment", "auth-mode", "operation"]) {
    if (!options[required]) throw new Error(`Preflight requires --${required}`);
  }
}

async function preflightCommand(configPath, options) {
  requiredPreflightOptions(options);
  if ((options.capability == null) !== (options.effect == null)) {
    throw new Error("Preflight --capability and --effect must be supplied together");
  }
  const config = await readConfig(configPath);
  const assessment = await preflight(config, {
    schema: "agentwex.preflight-query.v0.1",
    toolRegistry: options["tool-registry"],
    toolId: options.tool,
    toolVersion: options["tool-version"],
    clientId: options.client,
    clientVersion: options["client-version"],
    environment: options.environment,
    authMode: options["auth-mode"],
    operation: options.operation,
    ...(options.capability ? {
      capabilityId: options.capability,
      effectClass: options.effect,
      alternativePolicy: "same-capability",
    } : {}),
    maxAgeDays: Number(options["max-age-days"] ?? 7),
    minimumIndependentRoots: Number(options["minimum-independent-roots"] ?? options["minimum-signed-nodes"] ?? 2),
    unlock: options.unlock === true,
  });
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
}

async function alerts(configPath, options) {
  const config = await readConfig(configPath);
  process.stdout.write(`${JSON.stringify(await getReliabilityAlerts(config, options.limit ?? 50), null, 2)}\n`);
}

async function feedback(configPath, options) {
  if (!options.result || !options.outcome) throw new Error("Feedback requires --result and --outcome");
  const config = await readConfig(configPath);
  process.stdout.write(`${JSON.stringify(await submitFeedback(config, {
    schema: "agentwex.route-feedback.v0.1",
    resultId: options.result,
    outcome: options.outcome,
    failureClass: options["failure-class"] ?? null,
    attemptsAvoided: Number(options["attempts-avoided"] ?? 0),
    estimatedTokensAvoided: Number(options["estimated-tokens-avoided"] ?? 0),
    estimatedLatencyMsAvoided: Number(options["estimated-latency-ms-avoided"] ?? 0),
  }), null, 2)}\n`);
}

async function doctor(configPath) {
  const config = await readConfig(configPath);
  const checks = [];
  try { await getAccount(config); checks.push({ check: "exchange", status: "ok" }); }
  catch (error) { checks.push({ check: "exchange", status: "failed", error: error.message }); }
  try { await localJson(config, "/health"); checks.push({ check: "background_node", status: "ok" }); }
  catch (error) { checks.push({ check: "background_node", status: "failed", error: error.message }); }
  checks.push({ check: "privacy_policy", status: config.policy.shareRawTraces === false ? "ok" : "failed" });
  const configuredAdapters = Object.values(config.adapters ?? {}).filter((adapter) => adapter?.enabled === true);
  checks.push({ check: "runtime_adapter", status: configuredAdapters.length > 0 ? "ok" : "failed" });
  const localState = await localJson(config, "/awe/status").catch(() => null);
  checks.push({ check: "runtime_delivery", status: localState?.lastRuntimeOutcomeAt ? "ok" : "pending", lastObservedAt: localState?.lastRuntimeOutcomeAt ?? null });
  process.stdout.write(`${JSON.stringify({ checks }, null, 2)}\n`);
  if (checks.some((entry) => entry.status === "failed")) process.exitCode = 1;
}

async function inspect(configPath) {
  let config = null;
  try { config = await readConfig(configPath); }
  catch (error) {
    if (error?.code !== "ENOENT" && !String(error?.message ?? "").includes("no such file")) throw error;
  }
  process.stdout.write(`${JSON.stringify(buildPrivacyInspection(config), null, 2)}\n`);
}

async function main() {
  const { command, options, positional } = parseArgs(process.argv.slice(2));
  const configPath = resolve(options.config ?? defaultConfigPath());
  if (command === "help" || command === "--help" || command === "-h") return printHelp();
  if (command === "--version" || command === "-v" || command === "version") return process.stdout.write("agentwex 0.6.1\n");
  if (command === "install") return install(options);
  if (command === "uninstall") return uninstall(configPath, options);
  if (command === "rotate-keys") return rotateKeys(configPath);
  if (command === "runtimes") return runtimes(configPath);
  if (command === "adapter" && positional[0] === "claude-code") return configureClaudeCode(configPath, options);
  if (command === "adapter" && positional[0] === "codex") return configureCodex(configPath, options);
  if (command === "adapter" && positional[0] === "gemini-cli") return configureGeminiCli(configPath, options);
  if (command === "adapter" && positional[0] === "bernstein") return configureBernstein(configPath, options);
  if (command === "daemon") return runDaemon(configPath);
  if (command === "status") return status(configPath);
  if (command === "ledger" || command === "credits") return ledger(configPath);
  if (command === "contributions") return contributions(configPath, options);
  if (command === "contribution") return contribution(configPath, positional[0]);
  if (command === "preflight") return preflightCommand(configPath, options);
  if (command === "alerts") return alerts(configPath, options);
  if (command === "feedback") return feedback(configPath, options);
  if (command === "routes") return routes(configPath);
  if (command === "inspect") return inspect(configPath);
  if (command === "doctor") return doctor(configPath);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`Agent WEX node error: ${error.message}\n`);
  process.exitCode = 1;
});
