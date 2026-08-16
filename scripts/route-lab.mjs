import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { signRouteReceipt } from "../js/lib/attestation.mjs";
import { submitRouteOutcome } from "../js/lib/client.mjs";
import { defaultConfigPath, readConfig } from "../js/lib/config.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(await readFile(resolve(repositoryRoot, "lab/participants.json"), "utf8"));
const packageMetadata = JSON.parse(await readFile(resolve(repositoryRoot, "js/package.json"), "utf8"));

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

async function version(binary) {
  const result = await execFileAsync(binary, ["--version"], { timeout: 10_000 });
  const match = result.stdout.match(/\d+(?:\.\d+){1,3}/);
  return match?.[0] ?? "unknown";
}

async function npmInstallCanary(route) {
  const directory = await mkdtemp(resolve(tmpdir(), "agentwex-route-lab-"));
  try {
    await execFileAsync("npm", [
      "install", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", directory,
      `agentwex@${packageMetadata.version}`,
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
      clientId: "npm", clientVersion: await version("npm"), authMode: "none", operation: "install-package",
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
  const response = await fetch(`${config.exchange.baseUrl}/api/exchange/internal/lab-enroll`, {
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
  const route = await canary.descriptor();
  let outcome = "success";
  let errorClass = null;
  try {
    await canary.execute(route);
  } catch (error) {
    outcome = "failure";
    errorClass = String(error?.message ?? error).includes("timeout") ? "timeout" : "compatibility";
  }
  return { participantId, canaryId, startedAt, route, outcome, errorClass };
}

async function runCanary(config, participantId, canaryId) {
  const probe = await probeCanary(participantId, canaryId);
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
    creditsAwarded: contribution.creditsAwarded, sensitivePayloadStored: contribution.sensitivePayloadStored,
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
      : command === "probe"
        ? await probeCanary(selected.participantId, parsed.canary)
        : (() => { throw new Error("Usage: route-lab.mjs enroll|probe|run --participant ID [--canary ID] [--config PATH]"); })();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${basename(process.argv[1])}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
