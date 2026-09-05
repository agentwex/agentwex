# Agent WEX OpenAI plugin submission kit

## Product sentence

Agent WEX installs a local runtime reliability node beside AI agents, turns eligible completed public-tool outcomes into privacy-minimized signed compatibility receipts, checks shared evidence before retries, and returns recent recovery routes through the runtime's existing policy gate.

## Package

Submit the `agentwex/` directory in this folder as a skills-only plugin. It contains no MCP server or custom UI. The bundled skill covers installation and operation of the released `agentwex@0.6.2` npm package.

## Directory copy

- **Name:** Agent WEX
- **Subtitle:** Runtime reliability network for agent tools
- **Category:** Developer Tools
- **Description:** Install and operate Agent WEX's local runtime reliability node and shared compatibility-evidence network. Passively minimize eligible completed public-tool outcomes on the user's computer, check exact tool/runtime cells before retries, inspect reliability and alerts, contribute bounded signed receipts, and unlock recovery routes through the local policy gate.
- **Website:** https://agentwex.xyz
- **Support:** https://github.com/agentwex/agentwex/issues
- **Privacy:** https://agentwex.xyz/exchange/privacy
- **Terms:** https://agentwex.xyz/exchange/terms
- **Source:** https://github.com/agentwex/agentwex

## Reviewer notes

- The plugin is an instructional, skills-only package. It does not itself execute an MCP server or render custom UI.
- The npm installer creates a pseudonymous signing identity, starts a loopback collector, contacts the hosted Agent WEX exchange, and configures a supported runtime only when its telemetry destination is unclaimed.
- The skill requires explicit authorization before global installation or configuration changes and preserves existing telemetry exporters.
- The node minimizes locally before upload and excludes prompts, tool arguments, tool results, credentials, source code, customer content, private URLs, exception text, raw spans, and raw trace IDs.
- Returned routes are evidence only. They require the caller's own policy gate and do not authorize an action.
- The public preview is currently limited to macOS with Node.js 22.13 or newer. Known limits are disclosed in the repository security and privacy documentation.
- Authentication test credentials are not applicable to the plugin package. The node registers a pseudonymous identity during its separately authorized install workflow.

## Validation before upload

1. Run the plugin and skill validators from this repository's documented development environment.
2. Re-run the discovery cases in `discovery-evals.json` in ChatGPT developer mode and record selection precision and recall.
3. Confirm the npm version, checksum, website, privacy URL, and canonical skill URL still match the public release.
4. Exercise install, restart-required, telemetry-conflict, adapter-required, preflight, and uninstall paths on a clean supported test account.
5. Zip only the `agentwex/` package directory for submission.
