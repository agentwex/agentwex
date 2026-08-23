import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { signRouteReceipt } from "../js/lib/attestation.mjs";
import { preflight, submitFeedback, submitRouteOutcome } from "../js/lib/client.mjs";
import { defaultConfigPath, readConfig } from "../js/lib/config.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "lab/participants.json"), "utf8"));
const packageMetadata = JSON.parse(await readFile(resolve(repositoryRoot, "js/package.json"), "utf8"));
const LAB_NPM_VERSION = "11.17.0";
const MISSING_AGENTWEX_VERSION = "0.0.0-agentwex-route-lab-missing";

function sha(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function environmentName() {
  const platform = process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux";
  const architecture = process.arch === "arm64" ? "arm64" : "x64";
  return ["macos-arm64", "macos-x64", "linux-arm64", "linux-x64", "windows-x64"].includes(`${platform}-${architecture}`)
    ? `${platform}-${architecture}`
    : "other";
}

function participant(id) {
  const found = manifest.participants.find((candidate) => candidate.participantId === id);
  if (!found) throw new Error(`Unknown Route Lab participant: ${id ?? "missing"}`);
  return found;
}

async function npmInstallCanary(route) {
  const directory = await mkdtemp(resolve(tmpdir(), "agentwex-route-lab-"));
  try {
    await execFileAsync("npx", [
      "--yes", `npm@${LAB_NPM_VERSION}`, "install", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", directory,
      `agentwex@${route.toolVersion}`,
    ], { timeout: 120_000, maxBuffer: 1_048_576 });
    const binary = resolve(directory, "node_modules/agentwex/bin/agentwex.js");
    await execFileAsync(process.execPath, [binary, "--help"], { timeout: 20_000, maxBuffer: 1_048_576 });
    return route;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function npmRegistryCanary(route) {
  const response = await fetch("https://registry.npmjs.org/agentwex", { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`npm_registry_${response.status}`);
  const body = await response.json();
  if (body?.name !== "agentwex" || !body?.["dist-tags"]?.latest) throw new Error("npm_registry_invalid_metadata");
  return route;
}

async function githubRepositoryCanary(route) {
  const response = await fetch("https://api.github.com/repos/agentwex/agentwex", {
    headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "agentwex-route-lab" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`github_api_${response.status}`);
  const body = await response.json();
  if (body?.full_name !== "agentwex/agentwex") throw new Error("github_api_invalid_metadata");
  return route;
}

const canaries = {
  "npm-agentwex-install": {
    descriptor: async () => ({
      toolRegistry: "npm", toolId: "agentwex", toolVersion: packageMetadata.version,
      clientId: "npm", clientVersion: LAB_NPM_VERSION, authMode: "none", operation: "install-package",
      capabilityId: "agent-tool.install", effectClass: "execute",
    }),
    execute: npmInstallCanary,
  },
  "npm-agentwex-missing-version": {
    descriptor: async () => ({
      toolRegistry: "npm", toolId: "agentwex", toolVersion: MISSING_AGENTWEX_VERSION,
      clientId: "npm", clientVersion: LAB_NPM_VERSION, authMode: "none", operation: "install-package",
      capabilityId: "agent-tool.install", effectClass: "execute",
    }),
    execute: npmInstallCanary,
  },
  "npm-registry-metadata": {
    descriptor: async () => ({
      toolRegistry: "public-api", toolId: "registry.npmjs.org", toolVersion: "v1",
      clientId: "node", clientVersion: process.versions.node, authMode: "none", operation: "package-metadata-read",
      capabilityId: "package.metadata.read", effectClass: "read",
    }),
    execute: npmRegistryCanary,
  },
  "github-repository-read": {
    descriptor: async () => ({
      toolRegistry: "public-api", toolId: "api.github.com", toolVersion: "2022-11-28",
      clientId: "node", clientVersion: process.versions.node, authMode: "none", operation: "repository-read",
      capabilityId: "repository.metadata.read", effectClass: "read",
    }),
    execute: githubRepositoryCanary,
  },
};

async function enroll(config, participantId) {
  const token = process.env.AGENTWEX_LAB_ADMIN_TOKEN;
  if (!token) throw new Error("AGENTWEX_LAB_ADMIN_TOKEN is required for one-time lab enrollment");
  const response = await fetch(`${config.baseUrl}/api/exchange/internal/lab-enroll`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ agentId: config.agentId, controllerGroupId: manifest.controllerGroupId, participantId }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({ error: "invalid_json" }));
  if (!response.ok) throw new Error(body.error ?? `lab_enrollment_${response.status}`);
  return body;
}

async function probeCanary(participantId, canaryId) {
  const canary = canaries[canaryId];
  if (!canary) throw new Error(`Unknown Route Lab canary: ${canaryId ?? "missing"}`);
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const route = await canary.descriptor();
  let outcome = "success";
  let errorClass = null;
  try {
    await canary.execute(route);
  } catch (error) {
    outcome = "failure";
    errorClass = String(error?.message ?? error).includes("timeout") ? "timeout" : "compatibility";
  }
  return {
    participantId,
    canaryId,
    startedAt,
    completedAt: new Date().toISOString(),
    executionMs: Math.round(performance.now() - started),
    route,
    outcome,
    errorClass,
  };
}

async function submitProbe(config, participantId, canaryId, probe) {
  const { route, outcome, errorClass, startedAt } = probe;
  const routeIdentity = [route.toolRegistry, route.toolId, route.toolVersion, route.clientId, route.clientVersion,
    environmentName(), route.authMode, route.operation, route.capabilityId, route.effectClass].join("|");
  const receipt = signRouteReceipt({
    schema: "agentwex.working-route-comp.v0.3",
    ...route,
    environment: environmentName(), outcome, errorClass,
    resolutionKind: "none",
    routeFingerprint: sha(routeIdentity),
    observedAt: new Date().toISOString(),
    provenanceRootId: sha(`${participantId}|${canaryId}|${startedAt}|${randomUUID()}`),
    independenceBasis: "attested",
  }, config.signing);
  const contribution = await submitRouteOutcome(config, receipt);
  return {
    participantId, controllerGroupId: manifest.controllerGroupId, canaryId, outcome,
    contributionId: contribution.contributionId, status: contribution.status,
    creditsAwarded: contribution.creditsAwarded, freshnessRefresh: contribution.freshnessRefresh === true,
    executionMs: probe.executionMs, observedAt: receipt.observedAt,
    sensitivePayloadStored: contribution.sensitivePayloadStored,
  };
}

async function runCanary(config, participantId, canaryId) {
  return submitProbe(config, participantId, canaryId, await probeCanary(participantId, canaryId));
}

async function runBatch(config, participantId) {
  const startedAt = new Date().toISOString();
  const results = [];
  for (const canaryId of manifest.canaries) results.push(await runCanary(config, participantId, canaryId));
  return {
    schema: "agentwex.route-lab.batch.v1",
    participantId,
    controllerGroupId: manifest.controllerGroupId,
    startedAt,
    completedAt: new Date().toISOString(),
    results,
  };
}

function gateAllowsInstallRoute(route, allowed) {
  return route?.toolRegistry === allowed.toolRegistry
    && route?.toolId === allowed.toolId
    && route?.toolVersion === allowed.toolVersion
    && route?.clientId === allowed.clientId
    && route?.clientVersion === allowed.clientVersion
    && route?.authMode === allowed.authMode
    && route?.operation === allowed.operation
    && route?.capabilityId === allowed.capabilityId
    && route?.effectClass === allowed.effectClass;
}

async function runRoundTrip(config, participantId) {
  const startedAt = new Date().toISOString();
  const failed = await runCanary(config, participantId, "npm-agentwex-missing-version");
  if (failed.outcome !== "failure") throw new Error("Controlled missing-version canary unexpectedly succeeded");
  const failedDescriptor = await canaries["npm-agentwex-missing-version"].descriptor();
  const assessment = await preflight(config, {
    schema: "agentwex.preflight-query.v0.1",
    ...failedDescriptor,
    environment: environmentName(),
    alternativePolicy: "same-capability",
    maxAgeDays: 7,
    minimumIndependentRoots: 2,
    unlock: true,
  });
  const access = assessment.routeAccess;
  if (!access?.routeReceipt?.gateRequired || access.routeReceipt.authorityGranted !== false) {
    throw new Error("No Gate-bound route was released for the controlled blocker");
  }
  const returnedRoute = access.routeReceipt.workingRoute;
  const allowed = await canaries["npm-agentwex-install"].descriptor();
  if (!gateAllowsInstallRoute(returnedRoute, allowed)) throw new Error("Gate rejected the returned route outside the canary allowlist");
  const recoveryStarted = performance.now();
  await canaries["npm-agentwex-install"].execute(allowed);
  const recoveryProbe = {
    participantId,
    canaryId: "npm-agentwex-install",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    executionMs: Math.round(performance.now() - recoveryStarted),
    route: allowed,
    outcome: "success",
    errorClass: null,
  };
  const confirmed = await submitProbe(config, participantId, "npm-agentwex-install", recoveryProbe);
  const feedback = await submitFeedback(config, {
    schema: "agentwex.route-feedback.v0.1",
    resultId: access.resultId,
    outcome: "succeeded",
    failureClass: null,
    attemptsAvoided: 1,
    estimatedTokensAvoided: 0,
    estimatedLatencyMsAvoided: 0,
  });
  return {
    schema: "agentwex.route-lab.round-trip.v1",
    participantId,
    controllerGroupId: manifest.controllerGroupId,
    startedAt,
    completedAt: new Date().toISOString(),
    blocker: failed,
    navigator: {
      action: assessment.recommendation.action,
      evidenceConfidence: assessment.evidenceConfidence,
      resultId: access.resultId,
      creditsSpent: access.creditsSpent,
      supportStatus: returnedRoute.supportStatus,
      controllerIndependenceVerified: returnedRoute.controllerIndependenceVerified,
    },
    recovery: confirmed,
    feedbackId: feedback.feedbackId,
    authorityGranted: false,
  };
}

function options(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith("--")) continue;
    values[args[index].slice(2)] = args[index + 1];
    index += 1;
  }
  return values;
}

export async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  const parsed = options(rest);
  const selected = participant(parsed.participant);
  const result = command === "enroll"
    ? await enroll(await readConfig(parsed.config ?? defaultConfigPath()), selected.participantId)
    : command === "run"
      ? await runCanary(await readConfig(parsed.config ?? defaultConfigPath()), selected.participantId, parsed.canary)
      : command === "batch"
        ? await runBatch(await readConfig(parsed.config ?? defaultConfigPath()), selected.participantId)
        : command === "roundtrip"
          ? await runRoundTrip(await readConfig(parsed.config ?? defaultConfigPath()), selected.participantId)
      : command === "probe"
        ? await probeCanary(selected.participantId, parsed.canary)
        : (() => { throw new Error("Usage: route-lab.mjs enroll|probe|run|batch|roundtrip --participant ID [--canary ID] [--config PATH]"); })();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${basename(process.argv[1])}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
