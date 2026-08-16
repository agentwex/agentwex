# Agent WEX

![Conceptual Agent WEX receipt flow](docs/assets/agent-wex-social.png)

The image is a conceptual social-preview graphic: distinct tool/runtime nodes
emit many bounded receipts, repeated signals collapse through the center, and a
single compatibility route returns to the caller. It is not an architecture
diagram and does not claim that the pictured nodes are independently controlled.

Agent WEX is a compatibility-evidence network for agent tools. A participating
runtime reduces permitted tool outcomes to minimized signed receipts. The
exchange collapses repeated claims from the same registered node and can return
a recent configuration-shaped route when another agent encounters the same
compatibility failure.

Agent WEX does **not** build, host, execute, or orchestrate agents. A registered
signature identifies a pseudonymous node; it does not prove that a distinct
person or organization controls that node, or that the reported execution
genuinely happened. Returned routes are unverified network evidence and grant
no authority.

## Earn before you need it

Participation has no monetary charge. The node passively reduces completed tool
outcomes that the agent already produces; it does not create paid jobs, mining
work, or additional model calls. An accepted fresh compatibility contribution
earns two access credits, an accepted established contribution earns one, and
unlocking a route costs one. Early participants therefore accumulate credits
before they encounter a route they want to use. Credits are access units—not
money, tokens, trust weight, or a subscription—and there is no purchase path.

Receipt delivery runs in the background after tool completion and is kept off
the agent's execution path. The node still uses a small amount of local CPU,
memory, and network traffic; “free” means no Agent WEX fee, not literally zero
machine resources.

## Public-preview install

The canonical Node.js package version is `agentwex@0.6.0`. The public preview
supports macOS and Node.js 22.13 or newer:

```bash
npm install --global agentwex@0.6.0
agentwex install
```

The npm release is dependency-free, has no install lifecycle scripts, and is
published with registry provenance. Checksummed release artifacts are a
secondary verification/disaster-recovery channel, not the primary installer.

The installer creates a pseudonymous Ed25519 signing identity, detects supported
runtimes, refuses to overwrite an existing telemetry exporter, starts a
localhost collector on macOS, and verifies readiness. It does not submit prompts,
tool arguments, tool results, credentials, private URLs, source code, or raw
traces.

```bash
agentwex status
agentwex doctor
agentwex rotate-keys
agentwex uninstall --yes
```

`agentwex` is canonical. `awe` and `awe-node` are compatibility aliases.

## Repository map

- `js/` — dependency-free Node.js node and CLI
- `exchange/knowledge-exchange-v0.1/` — bounded protocol and schemas
- `db/` and `migrations/` — exchange API, ledger, and D1 schema
- `docs/` — privacy, security, protocol, and release boundaries
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
