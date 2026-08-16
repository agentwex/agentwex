import { createServer } from "node:http";
import { adaptOtelSpanToRouteOutcome } from "./receipt.mjs";
import { spansFromOtlpJson } from "./otlp.mjs";
import { spansFromClaudeCodeLogs } from "./claude-code.mjs";
import { spansFromCodexLogs } from "./codex.mjs";
import { spansFromGeminiCliLogs } from "./gemini-cli.mjs";
import { spansFromBernsteinEvents } from "./bernstein.mjs";
import { signRouteReceipt } from "./attestation.mjs";
import { createRouteQuery, getAccount, getContribution, getRouteQuery, submitRouteOutcome, unlockRoute } from "./client.mjs";
import { defaultConfigPath, readConfig, readState, writeState } from "./config.mjs";

const MAX_BODY_BYTES = 1_048_576;

function locallyAuthorized(request, token) {
  return request.headers.authorization === `Bearer ${token}`;
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function queryFromFailure(receipt) {
  return {
    schema: "minority-prophet.working-route-query.v0.1",
    toolRegistry: receipt.toolRegistry,
    toolId: receipt.toolId,
    attemptedToolVersion: receipt.toolVersion,
    clientId: receipt.clientId,
    attemptedClientVersion: receipt.clientVersion,
    environment: receipt.environment,
    authMode: receipt.authMode,
    operation: receipt.operation,
    localEvidenceStatus: "insufficient",
    localEvidenceReceiptHash: receipt.provenanceRootId,
    maxAgeDays: 7,
    minimumIndependentRoots: 2,
  };
}

export async function createNodeRuntime(configPath = defaultConfigPath()) {
  const config = await readConfig(configPath);
  let state = await readState(configPath) ?? {
    schema: "minority-prophet.awe-node-state.v0.1",
    pendingContributions: [], queries: [], routes: [], creditBalance: 0,
  };
  let operation = Promise.resolve();

  async function persist() {
    await writeState(configPath, state);
  }

  async function reconcile() {
    const account = await getAccount(config);
    state.creditBalance = account.creditBalance;
    for (const pending of [...state.pendingContributions]) {
      try {
        const contribution = await getContribution(config, pending.contributionId);
        pending.status = contribution.status;
        pending.creditsAwarded = contribution.creditsAwarded;
      } catch (error) {
        pending.lastError = error.message;
      }
    }
    state.pendingContributions = state.pendingContributions.filter((entry) => entry.status === "pending");
    for (const tracked of state.queries) {
      if (tracked.unlockedAt) continue;
      try {
        const query = await getRouteQuery(config, tracked.queryId);
        tracked.status = query.status;
        if (query.status === "RESULT_AVAILABLE" && state.creditBalance > 0) {
          const access = await unlockRoute(config, query.resultId);
          tracked.unlockedAt = new Date().toISOString();
          state.creditBalance = access.creditBalance;
          state.routes.push(access.routeReceipt);
        }
      } catch (error) {
        tracked.lastError = error.message;
      }
    }
    await persist();
    return state;
  }

  async function ingestSpans(spans, initial = {}) {
    const { runtimeSource = "generic-otlp", ...initialSummary } = initial;
    const summary = { received: spans.length, submitted: 0, ignored: 0, rejected: 0, queriesOpened: 0, ...initialSummary };
    for (const span of spans) {
      try {
        const adapted = adaptOtelSpanToRouteOutcome(span, {
          enabled: config.policy.shareToolOutcomes === true,
          shareToolOutcomes: config.policy.shareToolOutcomes === true,
          agentId: config.agentId,
        });
        if (adapted.status !== "READY_TO_SUBMIT") { summary.ignored += 1; continue; }
        const signedReceipt = signRouteReceipt(adapted.receipt, config.signing);
        const contribution = await submitRouteOutcome(config, signedReceipt);
        if (contribution.status === "pending" && !state.pendingContributions.some((entry) => entry.contributionId === contribution.contributionId)) {
          state.pendingContributions.push({
            contributionId: contribution.contributionId,
            outcome: adapted.receipt.outcome,
            status: contribution.status,
            submittedAt: new Date().toISOString(),
          });
        }
        summary.submitted += 1;
        const existingQuery = state.queries.find((entry) => entry.sourceContributionId === contribution.contributionId);
        if (adapted.receipt.outcome === "failure" && !existingQuery) {
          const query = await createRouteQuery(config, queryFromFailure(adapted.receipt));
          if (!state.queries.some((entry) => entry.queryId === query.queryId)) {
            state.queries.push({
              queryId: query.queryId,
              resultId: query.resultId,
              sourceContributionId: contribution.contributionId,
              status: query.status,
              openedAt: new Date().toISOString(),
            });
          }
          summary.queriesOpened += 1;
        }
      } catch (error) {
        summary.rejected += 1;
        summary.lastError = error.message;
      }
    }
    if (summary.submitted > 0) {
      state.lastRuntimeOutcomeAt = new Date().toISOString();
      state.lastRuntimeSource = runtimeSource;
    }
    await reconcile();
    return summary;
  }

  async function ingest(payload) {
    const spans = spansFromOtlpJson(payload);
    return ingestSpans(spans);
  }

  async function ingestClaudeCode(payload) {
    const adapted = spansFromClaudeCodeLogs(payload, config.adapters?.claudeCode);
    return ingestSpans(adapted.spans, { received: adapted.received, ignored: adapted.ignored, runtimeSource: "claude-code" });
  }

  async function ingestCodex(payload) {
    const adapted = spansFromCodexLogs(payload, config.adapters?.codex);
    return ingestSpans(adapted.spans, { received: adapted.received, ignored: adapted.ignored, runtimeSource: "codex" });
  }

  async function ingestGeminiCli(payload) {
    const adapted = spansFromGeminiCliLogs(payload, config.adapters?.geminiCli);
    return ingestSpans(adapted.spans, { received: adapted.received, ignored: adapted.ignored, runtimeSource: "gemini-cli" });
  }

  async function ingestBernstein(payload) {
    const adapted = spansFromBernsteinEvents(payload, config.adapters?.bernstein);
    return ingestSpans(adapted.spans, { received: adapted.received, ignored: adapted.ignored, runtimeSource: "bernstein" });
  }

  function serialized(task) {
    operation = operation.then(task, task);
    return operation;
  }

  return {
    config,
    getState: () => state,
    ingest: (payload) => serialized(() => ingest(payload)),
    ingestClaudeCode: (payload) => serialized(() => ingestClaudeCode(payload)),
    ingestCodex: (payload) => serialized(() => ingestCodex(payload)),
    ingestGeminiCli: (payload) => serialized(() => ingestGeminiCli(payload)),
    ingestBernstein: (payload) => serialized(() => ingestBernstein(payload)),
    reconcile: () => serialized(reconcile),
  };
}

export async function runDaemon(configPath = defaultConfigPath()) {
  const runtime = await createNodeRuntime(configPath);
  await runtime.reconcile();
  const host = "127.0.0.1";
  const port = runtime.config.collector.port;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${host}:${port}`);
    try {
      const geminiBase = `/gemini/${runtime.config.collector.token}`;
      const geminiPathAuthorized = url.pathname.startsWith(`${geminiBase}/`);
      if (!locallyAuthorized(request, runtime.config.collector.token) && !geminiPathAuthorized) return json(response, 401, { error: "invalid_local_collector_token" });
      if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { status: "ok", agentId: runtime.config.agentId, authorityGranted: false });
      if (request.method === "GET" && url.pathname === "/awe/status") return json(response, 200, runtime.getState());
      if (request.method === "GET" && url.pathname === "/awe/routes") return json(response, 200, { routes: runtime.getState().routes, authorityGranted: false });
      if (request.method === "POST" && url.pathname === "/v1/traces") {
        if (!(request.headers["content-type"] ?? "").includes("application/json")) return json(response, 415, { error: "otlp_json_required" });
        return json(response, 202, await runtime.ingest(await readJsonBody(request)));
      }
      if (request.method === "POST" && url.pathname === "/v1/logs") {
        if (!(request.headers["content-type"] ?? "").includes("application/json")) return json(response, 415, { error: "otlp_json_required" });
        return json(response, 202, await runtime.ingestClaudeCode(await readJsonBody(request)));
      }
      if (request.method === "POST" && url.pathname === "/v1/codex/logs") {
        if (!(request.headers["content-type"] ?? "").includes("application/json")) return json(response, 415, { error: "otlp_json_required" });
        return json(response, 202, await runtime.ingestCodex(await readJsonBody(request)));
      }
      if (request.method === "POST" && url.pathname === `${geminiBase}/v1/logs`) {
        if (!(request.headers["content-type"] ?? "").includes("application/json")) return json(response, 415, { error: "otlp_json_required" });
        return json(response, 202, await runtime.ingestGeminiCli(await readJsonBody(request)));
      }
      if (request.method === "POST" && url.pathname === "/v1/bernstein/events") {
        if (!(request.headers["content-type"] ?? "").includes("application/json")) return json(response, 415, { error: "json_required" });
        return json(response, 202, await runtime.ingestBernstein(await readJsonBody(request)));
      }
      if (request.method === "POST" && [`${geminiBase}/v1/metrics`, `${geminiBase}/v1/traces`].includes(url.pathname)) {
        return json(response, 202, { received: 0, ignored: true });
      }
      return json(response, 404, { error: "awe_node_route_not_found" });
    } catch (error) {
      return json(response, error.message === "payload_too_large" ? 413 : 400, { error: error.message });
    }
  });
  const timer = setInterval(() => void runtime.reconcile().catch(() => {}), runtime.config.pollSeconds * 1_000);
  timer.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  process.stdout.write(`Agent WEX node listening on http://${host}:${server.address().port}\n`);
  const close = () => new Promise((resolve) => {
    clearInterval(timer);
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
    server.close(resolve);
  });
  const shutdown = () => void close().then(() => process.exit(0));
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return { server, runtime, close };
}
