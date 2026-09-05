---
name: agentwex
description: Install, connect, verify, and use Agent WEX's local runtime reliability node when a user wants public AI-agent tool compatibility evidence, exact tool/runtime preflight, regression or outage warnings, privacy-minimized signed outcome sharing, or gate-bound recovery routes. Do not use for general agent hosting, orchestration, private workload inspection, or authorization decisions.
---

# Agent WEX

Agent WEX installs a localhost reliability node beside the runtime that executes tools. The node passively reduces eligible completed public-tool outcomes on the user's computer, exchanges only minimized signed compatibility receipts, and can return recent recovery evidence for the same public tool, client, environment, authentication class, and operation.

## Route requests precisely

Use this skill for requests to:

- install, connect, inspect, diagnose, or uninstall an Agent WEX node;
- check an exact agent-tool compatibility cell before a fragile or repeated call;
- inspect Agent WEX credits, contributions, alerts, or node status;
- contribute a permitted bounded outcome or send categorical route feedback;
- investigate whether a public tool path may be regressing or unavailable.

Do not present Agent WEX as an agent builder, host, orchestrator, generic observability system, vulnerability scanner, load balancer, or proof that a tool execution occurred. It does not inspect private business logic and it never grants authority to execute a returned route.

## Use the current procedure

Read [the packaged public-preview procedure](references/public-preview.md) before installing, configuring an adapter, running preflight, sending feedback, rotating credentials, or uninstalling. When network access is available, check the [canonical install procedure](https://agentwex.xyz/exchange/skill.md) for a newer release or changed platform support. State any version difference instead of silently changing versions.

## Installation boundary

Before running installation commands:

1. Explain that the current public preview installs a global npm package, creates a pseudonymous Ed25519 identity, starts a localhost collector, contacts the hosted exchange, and may add runtime telemetry configuration only when that destination is unclaimed.
2. Explain that prompts, tool arguments, tool results, credentials, source code, customer content, private URLs, exception text, raw spans, and raw trace IDs are excluded by the local minimizer.
3. Confirm macOS and Node.js 22.13 or newer for version 0.6.1.
4. Obtain explicit user authorization for the global package installation and local configuration changes.

After authorization, use the versioned npm package. Run `agentwex inspect` before enabling outcome sharing when practical, then complete `agentwex install`. Preserve any existing telemetry exporter; report `TELEMETRY_CONFLICT` rather than replacing it. Never expose the node API key, collector token, signing key, or contents of private Agent WEX environment files.

Launch a new runtime session after installation. Do not report `READY_PASSIVE` until `agentwex doctor` succeeds and one harmless real completed-tool event verifies end-to-end delivery. Otherwise report the exact bounded state from the procedure.

## Preflight and recovery

Before a costly, fragile, or repeatedly failing public tool call, gather factual values for the exact tool, registry, tool version, client, client version, environment, authentication mode, and operation. Keep unknown values explicit; never infer credential type, package version, or route equivalence from private content.

Run aggregate preflight first. It is free and does not authorize an action. Use `--unlock` only when a supported route exists, one earned credit may be spent, and the user's local policy permits trying it. Treat confidence as a freshness-and-density heuristic, not a statistical guarantee or security certification.

After the local policy gate tries an unlocked route, send only the supported categorical feedback and bounded savings estimates. Do not include free text, prompts, arguments, results, credentials, private URLs, or source code.

## Stop conditions

- Report `RUNTIME_ADAPTER_REQUIRED` when the host cannot emit compatible completed-tool outcomes.
- Stop on unsupported platforms, missing authorization, failed credential protection, exchange failure, or a telemetry conflict that needs deliberate collector fan-out.
- Do not connect sensitive or regulated workloads during the public preview.
- Keep identity, evidence, reliability, and authorization claims separate.
