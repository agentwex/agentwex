# Agent WEX

![Agent WEX: check before the call and turn failures into the next answer](docs/assets/agent-wex-social-v3.png)

The image is a conceptual social-preview graphic: distinct tool/runtime nodes
emit many bounded receipts, repeated signals collapse through the center, and a
single compatibility route returns to the caller. It is not an architecture
diagram and does not claim that the pictured nodes are independently controlled.

Agent WEX is a compatibility-evidence network for agent tools. A participating
runtime reduces permitted tool outcomes to minimized signed receipts. The
exchange collapses repeated claims from the same registered node and can return
a recent configuration-shaped route when another agent encounters the same
compatibility failure. Before a call, an agent can also inspect recent
success/failure rates, evidence freshness, confidence, and regression/outage
alerts for its exact public compatibility cell.

Agent WEX does **not** build, host, execute, or orchestrate agents. A registered
signature identifies a pseudonymous node; it does not prove that a distinct
person or organization controls that node, or that the reported execution
genuinely happened. Returned routes are unverified network evidence and grant
no authority.

## What it saves

The value is not merely abstract compute savings. Shared exact-cell evidence can
prevent failed calls, blind retries, documentation searches, repeated diagnostic
reasoning, and avoidable human intervention. That shortens task completion. As
coverage grows, the same bounded evidence can expose regressions, rollout
problems, expired integrations, authentication failures, and platform-specific
breakage. Broader fleet routing across different tools, providers, authentication
methods, and runtimes is a later layer; the public preview does not claim it.

## Earn before you need it

Agent WEX is free to join and use. The node passively reduces completed tool
outcomes that the agent already produces; it does not create extra work or
additional model calls. An accepted fresh compatibility contribution
earns two access credits, an accepted established contribution earns one, and
unlocking a route uses one earned credit. Early participants therefore accumulate credits
before they encounter a route they want to use. Credits are access units for
contribution and access only; they are non-transferable and never affect trust weight.

Receipt delivery runs in the background after tool completion and is kept off
the agent's execution path. The node still uses a small amount of local CPU,
memory, and network traffic. Agent WEX itself remains free to join and use.

## Public-preview install

The canonical public-preview package is `agentwex@0.6.1` on npm. The preview
supports macOS and Node.js 22.13 or newer:

```bash
npm install --global agentwex@0.6.1
agentwex install
```

The package is dependency-free and has no install lifecycle scripts. The
checksummed tarball on `agentwex.xyz` is the secondary verification and
recovery channel for the same release.

The installer creates a pseudonymous Ed25519 signing identity, detects supported
runtimes, refuses to overwrite an existing telemetry exporter, starts a
localhost collector on macOS, and verifies readiness. It does not submit prompts,
tool arguments, tool results, credentials, private URLs, source code, or raw
traces.

```bash
agentwex inspect
agentwex status
agentwex credits
agentwex contributions --limit 25
agentwex contribution <id>
agentwex preflight \
  --tool io.github.example/github-mcp --tool-registry mcp --tool-version 3.1.0 \
  --client claude-code --client-version 1.7.0 --environment macos-arm64 \
  --auth-mode oauth-pkce --operation repository-search
agentwex alerts
agentwex doctor
agentwex rotate-keys
agentwex uninstall --yes
```

`agentwex inspect` is an offline privacy preview. It shows the exact receipt and
failure-query field names, configured route mappings, exchange destination, and
excluded data without contacting the exchange or changing local settings.

`credits` displays the immutable credit activity ledger and current balance.
`contributions` displays the participant's paginated minimized submission
history—including pending, accepted, and collapsed records—while
`contribution <id>` displays one record. These views never return prompts, tool
arguments or results, credentials, source code, private URLs, provenance roots,
route fingerprints, or raw trace identifiers.

`preflight` is a free aggregate check. It uses the latest accepted outcome per
controller group to report current-route reliability, a bounded evidence-confidence
label, and 24-hour regression/outage alerts. When a supported alternative
exists, its actionable route remains sealed; adding `--unlock` deliberately
uses one earned credit and returns the route to the caller's policy Gate.
After trying it, report only the bounded outcome and optional savings counters:

```bash
agentwex feedback --result working-route:routeq_ID --outcome succeeded \
  --attempts-avoided 2 --estimated-tokens-avoided 4000 \
  --estimated-latency-ms-avoided 15000
```

Confidence is a heuristic based on signed-node density and freshness—not a
statistical guarantee, proof of controller independence, or authorization.

Privacy-safe aggregate coverage is available from `GET
/api/exchange/coverage`. Cells backed by fewer than two distinct signed nodes
are withheld. Distinct signed nodes are not claimed to be independent
controllers or proof that an execution genuinely occurred.

`agentwex` is canonical. `awe` and `awe-node` are compatibility aliases.

## Repository map

- `js/` — dependency-free Node.js node and CLI
- `app/`, `worker/`, and `public/` — the standalone agentwex.xyz site and hosted exchange surface
- `exchange/knowledge-exchange-v0.1/` — bounded protocol and schemas
- `db/` and `migrations/` — exchange API, ledger, and D1 schema
- `docs/` — privacy, security, protocol, and release boundaries
- `docs/DECISION-RELATIVE-INDEPENDENCE.md` — explicit proximal-root cuts, material sensitivity, and the unchanged public controller-group policy
- `docs/VERIFIER-OPERATIONS.md` — hosted verification policy and operator runbook
- `tests/` — installer, minimization, exchange, lifecycle, and adapter tests

The Python namespace remains reserved for a future portable receipt client. It
does not yet provide the Node exchange runtime.

## Public-preview limits

Stronger participant identity and Sybil resistance, Linux background-service
installation, automated deletion operations, operational restore drills, and an
independent security assessment remain production-readiness work. See
[Security](docs/SECURITY.md), [Privacy](docs/PRIVACY.md), and
[Protocol](docs/PROTOCOL.md).

Apache-2.0.
