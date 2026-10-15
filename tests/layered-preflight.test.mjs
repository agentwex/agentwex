import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { writePrivateJson, writeState } from "../js/lib/config.mjs";
import { runLayeredPreflight } from "../js/lib/layered-preflight.mjs";

const execFileAsync = promisify(execFile);
const evaluatedAt = "2026-10-15T12:00:00.000Z";
const query = {
  schema: "agentwex.preflight-query.v0.1",
  toolRegistry: "mcp",
  toolId: "io.github.example/github-mcp",
  toolVersion: "3.2.0",
  clientId: "codex",
  clientVersion: "1.8.0",
  environment: "macos-arm64",
  authMode: "oauth-pkce",
  operation: "repository-search",
  maxAgeDays: 7,
  minimumIndependentRoots: 2,
  unlock: false,
};

const localOutcome = {
  toolRegistry: query.toolRegistry,
  toolId: query.toolId,
  toolVersion: query.toolVersion,
  clientId: query.clientId,
  clientVersion: query.clientVersion,
  environment: query.environment,
  authMode: query.authMode,
  operation: query.operation,
  capabilityId: null,
  effectClass: null,
  outcome: "success",
  errorClass: null,
  resolutionKind: "none",
  observedAt: "2026-10-15T11:00:00.000Z",
};

function exchangeAssessment(overrides = {}) {
  return {
    schema: "agentwex.preflight-assessment.v0.1",
    currentRoute: { distinctControllerGroupCount: 0, distinctParticipantCount: 0 },
    recommendation: {
      action: "NO_RECENT_EVIDENCE",
      supportedAlternativeAvailable: false,
      firstPartyLabAlternativeAvailable: false,
      currentRouteSupported: false,
      routeDetailsSealed: false,
      creditRequiredToUnlock: 0,
      gateRequired: true,
      authorityGranted: false,
    },
    authorityGranted: false,
    ...overrides,
  };
}

async function stateDirectory(context, state) {
  const directory = await mkdtemp(resolve(tmpdir(), "agentwex-layered-preflight-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = resolve(directory, "config.json");
  if (state !== "corrupt") await writeState(configPath, state);
  else await writeFile(resolve(directory, "state.json"), "{not-json");
  return configPath;
}

test("layered preflight keeps local recall separate from an empty network assessment", async (context) => {
  const configPath = await stateDirectory(context, { localOutcomes: [localOutcome], creditBalance: 3 });
  const result = await runLayeredPreflight({
    configPath,
    config: { apiKey: "test", baseUrl: "https://example.test" },
    query,
    evaluatedAt,
    remotePreflight: async () => exchangeAssessment(),
    remoteAccount: async () => ({ creditBalance: 3 }),
  });

  assert.equal(result.schema, "agentwex.layered-preflight-assessment.v0.1");
  assert.equal(result.exchangeStatus, "available");
  assert.equal(result.localRecall.sampleCount, 1);
  assert.equal(result.localRecall.establishesNetworkSupport, false);
  assert.equal(result.labEvidence.available, false);
  assert.equal(result.networkEvidence.available, false);
  assert.equal(result.creditUtility.routeAvailable, false);
  assert.equal(result.creditUtility.canUnlock, false);
  assert.equal(result.authorityGranted, false);
});

test("layered preflight labels lab-only evidence without promoting it to network support", async (context) => {
  const configPath = await stateDirectory(context, { localOutcomes: [], creditBalance: 1 });
  const remote = exchangeAssessment({
    recommendation: {
      action: "UNLOCK_LAB_ROUTE",
      supportedAlternativeAvailable: false,
      firstPartyLabAlternativeAvailable: true,
      currentRouteSupported: false,
      routeDetailsSealed: true,
      creditRequiredToUnlock: 1,
      gateRequired: true,
      authorityGranted: false,
    },
    routeQuery: { status: "LAB_RESULT_AVAILABLE" },
  });
  const result = await runLayeredPreflight({
    configPath, config: {}, query, evaluatedAt,
    remotePreflight: async () => remote,
    remoteAccount: async () => ({ creditBalance: 1 }),
  });

  assert.equal(result.labEvidence.available, true);
  assert.equal(result.labEvidence.establishesNetworkSupport, false);
  assert.equal(result.networkEvidence.available, false);
  assert.equal(result.creditUtility.supportLevel, "lab-observed");
  assert.equal(result.creditUtility.canUnlock, true);
});

test("layered preflight exposes credit utility for a network-supported route", async (context) => {
  const configPath = await stateDirectory(context, { localOutcomes: [], creditBalance: 0 });
  const remote = exchangeAssessment({
    recommendation: {
      action: "UNLOCK_SUPPORTED_ROUTE",
      supportedAlternativeAvailable: true,
      firstPartyLabAlternativeAvailable: false,
      currentRouteSupported: false,
      routeDetailsSealed: true,
      creditRequiredToUnlock: 1,
      gateRequired: true,
      authorityGranted: false,
    },
    routeQuery: { status: "RESULT_AVAILABLE" },
  });
  const result = await runLayeredPreflight({
    configPath, config: {}, query, evaluatedAt,
    remotePreflight: async () => remote,
    remoteAccount: async () => ({ creditBalance: 0 }),
  });

  assert.equal(result.networkEvidence.available, true);
  assert.equal(result.networkEvidence.minimumDistinctControllerGroups, 2);
  assert.equal(result.creditUtility.balance, 0);
  assert.equal(result.creditUtility.unlockCost, 1);
  assert.equal(result.creditUtility.supportLevel, "network-supported");
  assert.equal(result.creditUtility.canUnlock, false);
});

test("exchange failure returns local recall but no sealed or unlockable route", async (context) => {
  const configPath = await stateDirectory(context, { localOutcomes: [localOutcome], creditBalance: 5 });
  const result = await runLayeredPreflight({
    configPath, config: {}, query, evaluatedAt,
    remotePreflight: async () => { throw new Error("exchange timeout"); },
    remoteAccount: async () => { throw new Error("exchange timeout"); },
  });

  assert.equal(result.exchangeStatus, "unavailable");
  assert.equal(result.localRecall.sampleCount, 1);
  assert.equal(result.recommendation.action, "REVIEW_LOCAL_HISTORY");
  assert.equal(result.recommendation.routeDetailsSealed, false);
  assert.equal(result.creditUtility.routeAvailable, false);
  assert.equal(result.creditUtility.canUnlock, false);
  assert.equal("exchangeAssessment" in result, false);
  assert.equal(result.authorityGranted, false);
});

test("corrupt local state degrades to empty recall while preserving remote evidence", async (context) => {
  const configPath = await stateDirectory(context, "corrupt");
  const result = await runLayeredPreflight({
    configPath, config: {}, query, evaluatedAt,
    remotePreflight: async () => exchangeAssessment(),
    remoteAccount: async () => ({ creditBalance: 2 }),
  });

  assert.equal(result.exchangeStatus, "available");
  assert.equal(result.localRecall.sampleCount, 0);
  assert.equal(result.creditUtility.balance, 2);
});

test("the CLI returns local recall successfully when the exchange is offline", async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), "agentwex-layered-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = resolve(directory, "config.json");
  await writePrivateJson(configPath, {
    schema: "minority-prophet.awe-node-config.v0.1",
    baseUrl: "http://127.0.0.1:9",
    agentId: "agent_00000000000000000000000000000000",
    apiKey: "offline-test-key",
    collector: { host: "127.0.0.1", port: 4318, token: "local-test-token" },
  });
  await writeState(configPath, { localOutcomes: [{ ...localOutcome, observedAt: new Date(Date.now() - 60_000).toISOString() }], creditBalance: 4 });
  const { stdout } = await execFileAsync(process.execPath, [
    resolve("js/bin/agentwex.js"), "preflight",
    "--tool", query.toolId, "--tool-registry", query.toolRegistry, "--tool-version", query.toolVersion,
    "--client", query.clientId, "--client-version", query.clientVersion, "--environment", query.environment,
    "--auth-mode", query.authMode, "--operation", query.operation, "--config", configPath,
  ], { timeout: 3_000 });
  const result = JSON.parse(stdout);

  assert.equal(result.exchangeStatus, "unavailable");
  assert.equal(result.localRecall.sampleCount, 1);
  assert.equal(result.creditUtility.canUnlock, false);
});
