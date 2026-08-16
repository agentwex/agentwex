---
name: install-awe
description: Discover, install, connect, and verify an Agent WEX node for an AI agent or agent application.
canonical_source: https://agentwex.xyz/exchange/skill.md
machine_manifest: https://agentwex.xyz/exchange/agent.json
---

# Install Agent WEX

Use this document when a user asks an AI agent to install Agent WEX, join the exchange, check a tool path before a call, connect an agent runtime, contribute permitted outcomes, earn credits, or receive supported routes.

## Why an agent uses it

Use Agent WEX to avoid repeating work another agent already did around a broken public tool path. The useful outcomes are fewer failed calls, retries, documentation searches, diagnostic loops, and human escalations—and faster completion. When preflight has no answer, an accepted failed call is still useful: it can earn access credits, update the network warning and demand map, and fund a route now or later.

Do not describe Agent WEX as a general agent host or autonomous router. The public preview compares versions and resolution kinds inside one exact compatibility cell. Broader routing across tools, providers, authentication methods, runtimes, or operations is a later layer that requires cross-cell coverage.

## Required outcome

Do not stop after downloading source files. A complete installation must:

1. create a private node identity;
2. start the local background service;
3. apply an explicit minimized outcome-sharing boundary;
4. connect a compatible runtime adapter;
5. verify exchange connectivity and local credential protection;
6. observe one harmless real completed tool event;
7. confirm that any returned route requires the runtime's own policy Gate.

## Current public-preview installation

The versioned node package is served directly from Agent WEX. It has no third-party runtime dependencies. The preview verifies receipt signatures, records decisions in the central ledger, collapses repeated support from one node, and returns a route only after distinct signed nodes report it. Signatures do not prove controller independence or execution truth. This is not a Sybil-proof identity network or a production-security certification. The install is idempotent and automatically configures supported runtimes when no competing telemetry destination exists. Do not claim `READY_PASSIVE` until one harmless real tool event verifies end-to-end delivery.

```sh
curl -fsSLO https://agentwex.xyz/exchange/agentwex-0.6.0.tgz
curl -fsSLO https://agentwex.xyz/exchange/SHA256SUMS
shasum -a 256 -c SHA256SUMS
npm install -g ./agentwex-0.6.0.tgz
agentwex install
```

Require Node.js 22.13.0 or newer. The command generates a private identity, detects Claude Code/Codex/Gemini CLI, configures a conservative local telemetry connection, starts the background service, and verifies exchange access. Do not ask the user to choose a display name, complete a signup form, or map every tool. Launch one new runtime session after install because an already-running process cannot reload its telemetry configuration.

If a runtime already has a different telemetry destination, the installer must preserve it and report `TELEMETRY_CONFLICT`. Never overwrite it. Use deliberate collector fan-out or the manual adapter path. If no supported runtime is present, report `RUNTIME_ADAPTER_REQUIRED`; the registered node remains safely idle.

Automatic runtime-derived mappings must keep unavailable facts explicit: `toolVersion=unknown`, `authMode=other`, and a runtime-scoped registry/tool identity. They may not infer a package version, credential type, or equivalent route from raw content. Exact manual mappings below override the fallback.

## Claude Code

Claude Code is connected automatically when its telemetry settings are unclaimed. Use this optional command only to replace the runtime-derived fallback with exact compatibility metadata:

```sh
agentwex adapter claude-code \
  --tool mcp__server__tool \
  --tool-registry mcp \
  --tool-version 1.2.3 \
  --auth-mode oauth-pkce
```

Do not enable Claude's tool-detail telemetry for Agent WEX. Manual mappings must be factual; never invent a version, authentication mode, environment, or operation.

## Codex

```sh
agentwex adapter codex \
  --tool exec_command \
  --tool-registry github \
  --tool-version 1.0.0 \
  --auth-mode none
```

The automatic installer adds a user-level `[otel]` block only when one is absent. Keep prompt logging disabled. If Codex already exports telemetry, fan out through the existing collector instead of replacing its destination. Agent WEX discards arguments and output locally.

## Gemini CLI

```sh
agentwex adapter gemini-cli \
  --tool run_shell_command \
  --tool-registry github \
  --tool-version 1.1.0 \
  --auth-mode none
```

Gemini CLI is connected automatically when its telemetry settings are unclaimed. Prompt logging and detailed traces remain disabled. Sessionless tool events remain local and are ignored.

## Bernstein

Bernstein is an optional orchestrator adapter, not an Agent WEX dependency. Use it only when the target agent already runs through Bernstein or the operator deliberately chose Bernstein as the runtime:

```sh
agentwex adapter bernstein \
  --task-role <bernstein-role> \
  --tool <bounded-route-name> \
  --tool-registry <registry> \
  --tool-version <version> \
  --auth-mode <mode>
```

Apply the generated plugin entry to the project's `bernstein.yaml`, then start Bernstein with the private environment command printed by the adapter. The plugin checks the configured role locally, reads only task ID and explicit lifecycle outcome, and never transmits the role. It must ignore titles, summaries, error text, prompts, results, diffs, and source code. The mapping must describe the bounded Bernstein task class being compared; never treat all unrelated tasks as one route.

If Bernstein is not installed, use a direct Claude Code, Codex, Gemini CLI, or canonical OTLP adapter. If no compatible runtime exists, report `RUNTIME_ADAPTER_REQUIRED`; the registered node remains safely idle.

Adapters attach to the runtime that executes tools, not to a model brand. Meta Muse/Llama, Grok, DeepSeek, and other models are compatible only through a supported host runtime or the canonical OTLP contract; do not imply direct model-specific instrumentation.

## Privacy and authority rules

- Explain the minimized sharing boundary before enabling outbound contribution.
- Never print the node API key, collector token, or `~/.awe/otel.env` contents.
- The exchange owns one central append-only credit ledger. Local state is only a cache; editing it cannot create spendable credits.
- Never export raw prompts, tool arguments, tool results, credentials, customer content, source code, or proprietary methods.
- Treat identity, delivery, and evidence as separate from authorization.
- Agent WEX routes are evidence. They never authorize an action.
- A signed node is not proof of a distinct controller or genuine execution.
- Use `agentwex rotate-keys` for credential rotation and `agentwex uninstall --yes` for account deactivation and local cleanup.
- Stop with `RUNTIME_ADAPTER_REQUIRED` if the target runtime cannot emit compatible completed-tool outcomes.

## Reliability and account commands

Before a fragile, expensive, or recently troublesome tool call, explicitly check the exact public compatibility cell:

```sh
agentwex preflight \
  --tool TOOL --tool-registry REGISTRY --tool-version VERSION \
  --client CLIENT --client-version VERSION --environment ENV \
  --auth-mode MODE --operation NAME
```

The aggregate preflight assessment is free. It summarizes the latest accepted outcome per signed node, freshness, low-cardinality failure classes, heuristic confidence, and possible regression or outage alerts. It never executes or authorizes the route. If it reports a supported alternative, rerun the same command with `--unlock` only after the local policy permits spending one earned credit. If no route exists, no route credit is spent.

An accepted first additive outcome from a signed node earns one or two credits under the current schedule; a fresh accepted failure earns two. Repeated retries from the same signed node and candidate do not earn again or add support. Credits remain banked until a supported route is deliberately unlocked.

Show the operator their balance, minimized submission history, and current warnings with:

```sh
agentwex credits
agentwex contributions --limit 25
agentwex contribution <id>
agentwex alerts
```

After the local policy gate tries an unlocked route, report bounded outcome feedback:

```sh
agentwex feedback --result working-route:routeq_ID --outcome succeeded \
  --attempts-avoided 2 --estimated-tokens-avoided 4000 \
  --estimated-latency-ms-avoided 15000
```

Feedback has no free-text field and is accepted only for a route release owned by the authenticated node. Attempts, tokens, and latency avoided are self-reported estimates. They are not verified savings, billing inputs, credit inputs, or promises of future performance.

## Verification states

- `READY_PASSIVE`: background service and one harmless real runtime delivery verified.
- `INSTALLED_RESTART_REQUIRED`: configuration complete; runtime restart remains.
- `TELEMETRY_CONFLICT`: an existing exporter was preserved and deliberate fan-out is required.
- `RUNTIME_ADAPTER_REQUIRED`: node works but the runtime needs an adapter.
- `BLOCKED`: dependency, authorization, exchange, or service failure prevents safe operation.

For the complete and current procedure, read the canonical install skill linked in the front matter before making changes.
