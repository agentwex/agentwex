# Agent WEX node

The Agent WEX node is an install-once, localhost-only collector for minimized tool outcomes. After the explicit installation/consent step, it runs in the background:

1. receives completed tool spans over OTLP/HTTP JSON;
2. removes prompts, tool arguments, tool results, credentials, URLs, and raw trace identifiers;
3. submits a compact success/failure compatibility receipt;
4. tracks verification and credits;
5. opens a working-route query after a failure;
6. returns a signed-node-supported route receipt to the local agent when one becomes available.

An accepted fresh contribution earns two credits under the current transparent schedule. Unlocking a completed working-route result spends one credit. Duplicate retries and additional roots from the same signed node do not earn again. Credits live in one exchange-owned append-only ledger; `~/.awe/state.json` is only a local cache and cannot change the server balance.

The route is advice, not authority. It must return through the caller's Gate or policy system before use. A registered signing key authenticates a pseudonymous node. It does not prove that a different human or organization controls that node, or that a reported execution genuinely happened. Returned routes are explicitly labeled unverified network evidence.

## Public-preview node install

Install the versioned dependency-free node package:

```sh
curl -fsSLO https://agentwex.xyz/exchange/agentwex-0.6.0.tgz
curl -fsSLO https://agentwex.xyz/exchange/SHA256SUMS
shasum -a 256 -c SHA256SUMS
npm install -g ./agentwex-0.6.0.tgz
agentwex install
```

The command is idempotent. It generates the node's private identity, registers it with the exchange, detects Claude Code, Codex, and Gemini CLI, writes a conservative user-level telemetry connection, starts the background node, and verifies the exchange and local service. No display name, browser form, or per-tool mapping is required. Launch a new runtime session once after installation; an already-running process cannot reload its telemetry configuration.

Automatic mappings use only the runtime and tool identity actually emitted. Unknown package versions and authentication modes remain `unknown`/`other`; they are not guessed. This creates narrower runtime-bound route families. A precise manual mapping can replace that fallback whenever exact compatibility metadata is available. Existing non-Agent-WEX telemetry exporters are never overwritten: installation stops with `TELEMETRY_CONFLICT` instead.

## Claude Code adapter

Claude Code is connected automatically when its user telemetry settings are unclaimed. For a more precise route family, optionally bind an eligible tool explicitly:

```bash
agentwex adapter claude-code \
  --tool mcp__github__search_repositories \
  --tool-registry mcp \
  --tool-version 3.2.0 \
  --auth-mode oauth-pkce \
  --operation repository-search
```

The command writes a private `~/.awe/claude-code.env`. It enables Claude Code's documented OTLP `tool_result` logs without enabling tool-detail export. Start Claude Code with the printed `source ... && claude` command.

The adapter reads outcome, tool name, correlation ID, time, and error class. It never reads or submits prompts, tool parameters, tool inputs, tool results, credentials, URLs, or raw correlation IDs.

## Codex adapter

Codex is connected automatically when its user configuration has no competing `[otel]` exporter. Agent WEX reads only the event name, tool name, call ID, time, and explicit success flag, then discards arguments and output locally. Use the manual command below only to supply more precise compatibility metadata:

```bash
agentwex adapter codex \
  --tool exec_command \
  --tool-registry github \
  --tool-version 1.0.0 \
  --auth-mode none
```

The automatic installer writes the user-level `[otel]` block only when safe. If an exporter already exists, it fails closed so an operator can deliberately configure collector fan-out. Prompt logging remains disabled.

## Gemini CLI adapter

Gemini CLI is connected automatically with prompt logging and detailed traces disabled. The manual command below is an optional precision override:

```bash
agentwex adapter gemini-cli \
  --tool run_shell_command \
  --tool-registry github \
  --tool-version 1.1.0 \
  --auth-mode none
```

The command writes a private `~/.awe/gemini-cli.env`. It disables prompt logging and detailed traces, and authenticates its loopback collector path without exposing the credential in public configuration.

## Bernstein adapter

Bernstein is optional. It is useful when Bernstein already orchestrates the agents because one local lifecycle plugin can observe explicit completed/failed tasks across Bernstein's supported CLI runtimes. Do not install a full orchestrator solely to satisfy Agent WEX when a direct adapter already fits.

```bash
agentwex adapter bernstein \
  --task-role migration \
  --tool repository_migration \
  --tool-registry github \
  --tool-version 1.0.0 \
  --auth-mode none \
  --operation repository-migration
```

The command writes a private plugin, environment file, and `bernstein.yaml` snippet. The plugin observes only the configured role so unrelated Bernstein tasks cannot collapse into the same route. It emits only task ID, explicit completed/failed outcome, the operator-mapped route name, and time to the loopback node; the role is checked locally and is not transmitted. It ignores task titles, result summaries, error text, prompts, outputs, diffs, and source code. Bernstein plugin failures cannot stop the underlying run.

This adapter observes the Bernstein task lifecycle. It does not pretend Bernstein's run-level spans are detailed inner tool results. Use a direct runtime adapter or canonical OTLP integration when individual tool calls are the comparison unit.

Adapters belong to the runtime that executes a tool, not to the model brand. Meta Muse/Llama, Grok, DeepSeek, and other models are supported through their host runtime (for example LangGraph, an MCP gateway, or a compatible OTLP agent runner) rather than by duplicating model-specific adapters.

The installer creates a private `~/.awe/config.json`, including an Ed25519 receipt-signing key, backs up any runtime settings it changes, and, on macOS, installs a LaunchAgent that keeps the collector running. The API key authenticates the account; the signing key proves which registered node emitted a minimized receipt; the localhost collector token prevents local injection. None is a private credit balance. The installer never prints these credentials.

Connect any runtime that already emits OTLP/HTTP JSON:

```sh
source ~/.awe/otel.env
```

The private environment file contains the localhost collector credential and is created with mode `0600`.

Then inspect the node:

```sh
agentwex status
agentwex ledger
agentwex routes
agentwex doctor
```

Rotate both the API credential and local Ed25519 identity with `agentwex rotate-keys`. Remove the background service, exact Agent WEX runtime settings, local config, and remote pseudonymous account with `agentwex uninstall --yes`. Add `--keep-account` or `--keep-local` only when you deliberately want those retained. Runtime-setting backups are kept locally.

## Honest boundary

This is not zero-consent surveillance. The one install command is the operator's explicit consent step. Agent WEX cannot observe software that emits no supported telemetry or lifecycle hook. Without one, installation reports `RUNTIME_ADAPTER_REQUIRED` and the registered node remains safely idle. `INSTALLED_RESTART_REQUIRED` means setup is complete and a newly launched runtime will participate; `READY_PASSIVE` is reserved for verified real event delivery.

The initial durable store needs ordinary metadata rows, not a massive trace database. Raw traces remain local. Scale-out storage should be introduced only after measured D1 limits require it.

See [`PRODUCTION-READINESS.md`](../../exchange/knowledge-exchange-v0.1/PRODUCTION-READINESS.md) for the enforced controls and remaining launch gates.
